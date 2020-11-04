import Server from "./server";


test('server creation', async () => {
  const server = new Server();
  if (!(await server.ready)) {
    console.log('exited early');
    return;
  }

  const user = server.cred.user;
  await server.createGame({});

  await server.send();
  await server.send();
});
