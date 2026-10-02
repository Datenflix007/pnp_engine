// Add form for role assignment
const form = document.createElement('form');
form.innerHTML = `
  <select name="player" required></select>
  <select name="role" required></select>
  <button type="submit">Assign</button>
`;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  socket.emit('assignRole', Object.fromEntries(data));
});
document.body.appendChild(form);