let socketServer = {
  emit() {}
};

export function setSocketServer(server) {
  socketServer = server;
}

export function getSocketServer() {
  return socketServer;
}
