// public/js/main.js

// Handle Clock In
document.getElementById('clockInBtn').addEventListener('click', function() {
  fetch('/clock-in', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      const statusDiv = document.getElementById('status');
      if (data.success) {
        statusDiv.innerText = 'Clocked in successfully!';
        statusDiv.classList.remove('d-none', 'alert-danger');
        statusDiv.classList.add('alert-success');
      } else {
        statusDiv.innerText = 'Error clocking in.';
        statusDiv.classList.remove('d-none', 'alert-success');
        statusDiv.classList.add('alert-danger');
      }
    })
    .catch(err => console.error(err));
});

// Handle Clock Out
document.getElementById('clockOutBtn').addEventListener('click', function() {
  fetch('/clock-out', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      const statusDiv = document.getElementById('status');
      if (data.success) {
        statusDiv.innerText = 'Clocked out successfully!';
        statusDiv.classList.remove('d-none', 'alert-danger');
        statusDiv.classList.add('alert-success');
      } else {
        statusDiv.innerText = 'Error clocking out.';
        statusDiv.classList.remove('d-none', 'alert-success');
        statusDiv.classList.add('alert-danger');
      }
    })
    .catch(err => console.error(err));
});
