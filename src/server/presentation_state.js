const validModes = ['LOBBY', 'MESSAGE', 'BLACK'];

const setPresentationMode = (socket, data) => {
  if (!validModes.includes(data.mode)) {
    return socket.emit('error', 'Invalid presentation mode');
  }
  // Save mode to state or broadcast
  socket.broadcast.emit('presentationModeUpdate', { mode: data.mode });
};

module.exports = { setPresentationMode };