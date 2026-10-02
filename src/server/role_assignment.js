const isGM = (user) => {
  // Implement GM check logic
  return user.role === 'GM';
};

const assignRole = (socket, data) => {
  if (!isGM(socket.user)) {
    return socket.emit('error', 'Only GM can assign roles');
  }
  // Save role assignment to database
};

module.exports = { assignRole };