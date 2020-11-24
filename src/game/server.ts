import firebase from 'firebase';
import seedrandom from 'seedrandom';
import App from './firebase';


type DataSnapshot = firebase.database.DataSnapshot;

export interface CreateGameOptions {
  minPlayers?: number;
};

interface JoinGameOptions {
  id: string;
};

export interface EventMessage<T=any> {
  id: number;
  sender: string;
  timestamp: number;
  payload: T;
  /** Indicates that this message is a reply to a previous message */
  reId?: number;
};

export interface PrivateEventMessage extends EventMessage {
  id: null;
  priv: true;
};

export interface GameConfig {
  seed: string;
  /** Minimum number of players */
  minPlayers: number;
}

interface GameMeta {
  /** The uid of the owner */
  owner: string;
  /** Timestamp */
  created: number;
}

interface GameOptions {
  /** Keys in config can be modified by the owner. All other fields cannot be changed after the game is created. */
  config: GameConfig;
  meta: GameMeta;
};

type EventHandler = (event: EventMessage, server: Server) => any;

interface ServerOptions {
  debug: boolean;
  handler: EventHandler;
};

const dbOnce = (query: firebase.database.Query): Promise<DataSnapshot> =>
  new Promise(resolve => {
    query.once('value', snap => resolve(snap));
  });

class ServerError extends Error {}
class PermissionDenied extends ServerError {
  code = 'permission-denied';
}

class Server {
  auth: firebase.auth.Auth;
  db: firebase.database.Database;

  ref: firebase.database.Reference;
  rand: seedrandom.prng;
  gameOptions: GameOptions;

  /** Id of the last event on the server */
  lastKey = 0;

  /** Id of the last event to be processed */
  lastProcessed = 0;

  /** Timestamp of the last processed event */
  lastTimestamp = 0;

  /** Last used id when the game is first loaded */
  startingId = 0;

  /** Response messages waiting to be queued */
  responses = new Map<number, any>();

  ready: Promise<boolean>;
  cred: firebase.auth.UserCredential;

  /** Received messages that are waiting to be processed */
  pendingMessages = new Map<number, any>();
  handler: EventHandler;

  _gameReady: Promise<boolean>;
  _resolveGameReady: (x: any) => any;

  get owner() {
    return this.gameOptions.meta.owner;
  }

  get userId() {
    return this.auth.currentUser?.uid;
  }

  get gameId() {
    return this.ref.key;
  }

  get config() {
    return this.gameOptions.config;
  }

  get gameReady() {
    // This will have issues with multiple games
    if (!this._gameReady) {
      this._gameReady = new Promise(resolve => {
        this._resolveGameReady = resolve;
      });
    }

    return this._gameReady;
  }

  resolveGameReady() {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.gameReady;
    this._resolveGameReady(true);
  }

  constructor(options: Partial<ServerOptions> = {}) {
    // super();

    const { debug = false } = options;

    if (debug) {
      this.auth = firebase.auth();
      this.db = firebase.database();

      this.auth.useEmulator('http://localhost:9099');
      this.db.useEmulator('localhost', 9000);
    } else {
      this.auth = App.auth();
      this.db = App.database();
    }

    if (options.handler)
      this.handler = options.handler;

    this.ready = new Promise(resolve => {
      this.auth.signInAnonymously().then(
        cred => {
          this.cred = cred;
          resolve(true);
        },
        e => {
          console.error(e);
          resolve(false);
        });
    });
  }

  /// Internal methods
  getOnce = (field: string) => new Promise(resolve => {
    this.ref.child(field).once('value', val => {
      resolve(val.val());
    })
  });

  async startListening() {
    const promises = Promise.all([
      this.getOnce('meta'),
      this.getOnce('config'),
      dbOnce(this.ref.child('events').orderByKey().limitToLast(1)),
    ]);
    const [meta, config, lastEvent] = await promises as [GameMeta, GameConfig, firebase.database.DataSnapshot];
    this.resolveGameReady();

    this.gameOptions = { meta, config };

  {
    const val = lastEvent.val();
    if (val) {
      this.startingId = this.lastKey = parseInt(Object.keys(val)[0]);
    }}

    this.configWasChanged();

    this.ref.child('config').on('value', this.onConfigChanged, this);

    this.ref.child(`inbox/${this.userId}`)
      .orderByChild('timestamp')
      .on('child_added', this._onPrivateEventAdded);
    this.ref.child('events')
      .orderByKey()
      .on('child_added', this.onEventAdded, this.onCancel, this);
  }

  stopListening() {
    this.ref.child('config').off('value', this.onConfigChanged);
    this.ref.child('events').off('child_added', this.onEventAdded);
    this.ref.child(`inbox/${this.userId}`).off('child_added', this._onPrivateEventAdded);
  }

  onConfigChanged(snap: DataSnapshot) {
    this.gameOptions.config = snap.val();
    this.configWasChanged();
  }

  configWasChanged() {
    this.rand = seedrandom(this.gameOptions.config.seed);
  }

  async onEventAdded(snap: DataSnapshot, prevChildKey?: string) {
    const n = parseInt(snap.key);
    const event = Object.assign(snap.val(), { id: n }) as EventMessage;

    this.lastKey = Math.max(this.lastKey, n);

    if (n - this.lastProcessed > 1) {
      // If it's a non-consecutive message, pop it on the pending queue
      this.pendingMessages.set(n, event);
    } else {
      this.processMessage(event);
      this.processPending();
    }
  }

  async _onPrivateEventAdded(snap: DataSnapshot) {
    try {
      const event = snap.val() as PrivateEventMessage;
      const result = this.handler?.(event, this);

      if (result.then) await result;
    } catch (e) {

    }
  }

  /**
   * Process messages that were received prematurely
   */
  async processPending() {
    while (true) {
      const n = this.lastProcessed + 1;
      const event = this.pendingMessages.get(n);
      if (!event)
        break;

      await this.processMessage(event);
    }

    await this.sendQueuedResponses();
  }

  async sendQueuedResponses() {
    for (const [reId, payload] of this.responses.entries()) {
      try {
        await this.send(payload, reId);
      } catch (err) {
        console.error('Error sending response to message', reId, 'payload', payload);
      }
    }

    this.responses.clear();
  }

  async processMessage(event: EventMessage) {
    try {
      if (event.timestamp - this.lastTimestamp <= -30000) {
        // Skip stale event
        return;
      }
      const result = this.handler?.(event, this);

      if (result.then) await result;
    } catch (e) {
      // TODO As the need arises, introduce error types that can send messages back to the server
    } finally {
      this.lastTimestamp = event.timestamp;
      this.lastProcessed = event.id;

      // Remove the pending response
      if (event.reId && event.sender === this.userId)
        this.responses.delete(event.reId);
    }
  }

  onCancel(_error: Error) {

  }

  /// Public methods
  async createGame(options: CreateGameOptions = {}) {
    options = Object.assign({
      minPlayers: 2
    }, options);
    // const seed = Math.
    const seed = Math.random().toString(32) + Date.now().toString(32);
    this.ref = await this.db.ref('games').push({
      meta: {
        owner: this.auth.currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      },
      config: {
        seed,
        ...options
      }
    });
    await this.startListening();
  }

  async updateConfig(config: Partial<GameConfig>) {
    if (this.owner !== this.auth.currentUser.uid)
      throw new PermissionDenied('Only the owner can modify the game configuration');

    return await this.ref.child('config').update(config);
  }

  async joinGame(options: JoinGameOptions) {
    this.ref = this.db.ref(`games/${options.id}`);
    await this.startListening();
  }

  async send(payload: any, reId: number = null) {

  async send(payload: any, reId: number = null, recipient: string = null) {
    await this.gameReady;

    const data: any = {
      sender: this.userId,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      payload
    };

    if (recipient) {
      await this.ref.child(`inbox/${recipient}`).push(data);
      return;
    }

    if (reId) {
      if (this.startingId > this.lastProcessed) {
        this.responses.set(reId, payload);
        return;
      }

      data.reId = reId;
    }

    // Find the next unused id
    let n = this.lastKey + 1;

    while (true) {
      try {
        await this.ref.child(`events/${n}`).set(data);
        break;
      } catch (e) {
        console.log(e);
        n++
      }
    }
  }
}

export default Server;
