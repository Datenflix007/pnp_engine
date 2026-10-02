// Add dropdown for players and templates
const playerSelect = document.createElement('select');
const templateSelect = document.createElement('select');
// Populate with players and templates
document.body.appendChild(playerSelect);
document.body.appendChild(templateSelect);

const assignButton = document.createElement('button');
assignButton.textContent = 'Assign';
assignButton.addEventListener('click', () => {
  const playerId = playerSelect.value;
  const templateId = templateSelect.value;
  socket.emit('assignCharacterTemplate', { playerId, templateId });
});
document.body.appendChild(assignButton);