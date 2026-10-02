// Add form for character templates
const form = document.createElement('form');
form.innerHTML = `
  <input type="text" name="name" placeholder="Name" required>
  <input type="url" name="avatar" placeholder="Avatar URL">
  <input type="text" name="class" placeholder="Class">
  <textarea name="attributes" placeholder="Attributes"></textarea>
  <button type="submit">Save</button>
`;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  socket.emit('saveCharacterTemplate', Object.fromEntries(data));
});
document.body.appendChild(form);