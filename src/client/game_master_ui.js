// Add mode selection UI
const modeSelect = document.createElement('select');
modeSelect.innerHTML = `
  <option value="LOBBY">Lobby</option>
  <option value="MESSAGE">Message</option>
  <option value="BLACK">Black</option>
`;
modeSelect.addEventListener('change', (e) => {
  const mode = e.target.value;
  socket.emit('setPresentationMode', { mode });
});
document.body.appendChild(modeSelect);