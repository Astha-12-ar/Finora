// Redirect to login if no session exists
const session = JSON.parse(localStorage.getItem("finora_session"));
if (!session) {
  window.location.href = "index.html";
}