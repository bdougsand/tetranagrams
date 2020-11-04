import firebase from 'firebase';
import seedrandom from 'seedrandom';

import firebaseConfig from './firebaseConfig'


interface CreateGameOptions {};

interface JoinGameOptions {
  id: string;
};

export interface EventMessage<T=any> {
  id: number;
  sender: string;
  timestamp: number;
  payload: T;
};

interface GameConfig {
  seed: string;
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

const dbOnce = (query: firebase.database.Query): Promise<firebase.database.DataSnapshot> =>
  new Promise(resolve => {
    query.once('value', snap => resolve(snap));
  });

class Server {
  app = firebase.initializeApp(firebaseConfig);
  auth: firebase.auth.Auth;
  db: firebase.database.Database;

  ref: firebase.database.Reference;
  rand: seedrandom.prng;
  gameOptions: GameOptions;

  /** Number of the last event on the server */
  lastKey = 0;

  /** Number of the last event to be processed */
  lastProcessed = 0;

  lastTimestamp = 0;

  ready: Promise<boolean>;
  cred: firebase.auth.UserCredential;

  pendingMessages = new Map<number, any>();
  handler: EventHandler;

  get owner() {
    return this.gameOptions.meta.owner;
  }

  get userId() {
    return this.auth.currentUser?.uid;
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
      this.auth = this.app.auth();
      this.db = this.app.database();
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
    const [meta, config, lastEvent] =
      await Promise.all([
        this.getOnce('meta'),
        this.getOnce('config'),
        dbOnce(this.ref.child('events').orderByKey().limitToLast(1)),
      ]) as [GameMeta, GameConfig, firebase.database.DataSnapshot] ;

    this.gameOptions = { meta, config };
    this.lastKey = parseInt(lastEvent.key);
    this.configWasChanged();

    this.ref.child('config').on('value', this.onConfigChanged, this);
    this.ref.child('events')
      .orderByKey()
      .on('child_added', this.onEventAdded, this.onCancel, this);
  }

  stopListening() {
    this.ref.child('config').off('value', this.onConfigChanged);
    this.ref.child('events').off('child_added', this.onEventAdded);
  }

  onConfigChanged(snap: firebase.database.DataSnapshot) {
    this.gameOptions.config = snap.val();
    this.configWasChanged();
  }

  configWasChanged() {
    this.rand = seedrandom(this.gameOptions.config.seed);
  }

  onEventAdded(snap: firebase.database.DataSnapshot, prevChildKey?: string) {
    const k = snap.key;
    const n = parseInt(k);
    const event = Object.assign(snap.val(), { id: n });

    if (n - this.lastKey > 1) {
      // If it's a non-consecutive message, pop it on the pending queue
      this.pendingMessages.set(n, event);
    } else {
      this.processMessage(event);
      this.lastKey = n;
      this.processPending();
    }
  }

  /**
   * Process messages that were received prematurely
   */
  processPending() {
    while (true) {
      const n = this.lastProcessed + 1;
      const event = this.pendingMessages.get(n);
      if (!event)
        break;

      this.processMessage(event);
      this.lastProcessed = n;
    }
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
    }
  }

  onCancel(error: Error) {

  }

  /// Public methods
  async createGame(options: CreateGameOptions) {
    // const seed = Math.
    const seed = Math.random().toString(32) + Date.now().toString(32);
    this.ref = await this.db.ref('games').push({
      meta: {
        owner: this.auth.currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      },
      config: {
        seed
      }
    });
    this.startListening();
  }

  async updateConfig(config: Partial<GameConfig>) {
    if (this.owner !== this.auth.currentUser.uid)
      throw 'Only the owner can modify the game configuration';

    return await this.ref.child('config').update(config);
  }

  joinGame(options: JoinGameOptions) {
    this.ref = this.db.ref(`games/${options.id}`);
    this.startListening();
  }

  async send() {
    let n = this.lastKey + 1;

    while (true) {
      try {
        await this.ref.child(`events/${n}`).set({
          sender: this.auth.currentUser?.uid,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        break;
      } catch (e) {
        n++
      }
    }
  }
}

export default Server;
