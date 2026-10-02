const os = require('os');

const getPublicIP = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const interface of interfaces[interfaceName]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost'; // Fallback
};

const generateJoinURL = (sessionCode, port) => {
  const ip = getPublicIP();
  return `http://${ip}:${port}/join/${sessionCode}`;
};

module.exports = { generateJoinURL };