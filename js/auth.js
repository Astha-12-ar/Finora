document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const loginBtn = document.getElementById("loginBtn");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    emailError.textContent = "";
    passwordError.textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    let isValid = true;

    // Email format check
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      emailError.textContent = "Enter a valid email address.";
      isValid = false;
    }

    // Password length check
    if (password.length < 6) {
      passwordError.textContent = "Password must be at least 6 characters.";
      isValid = false;
    }

    if (!isValid) return;

    // Loading state
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    setTimeout(() => {
      const matchedUser = USERS.find(
        (u) => u.email === email && u.password === password
      );

      if (matchedUser) {
        // Demo-only session flag — NOT secure auth, just UI state
        localStorage.setItem("finora_session", JSON.stringify({
          userId: matchedUser.id,
          name: matchedUser.name,
          loggedInAt: new Date().toISOString()
        }));
        window.location.href = "dashboard.html";
      } else {
        passwordError.textContent = "Invalid email or password.";
        loginBtn.disabled = false;
        loginBtn.textContent = "Log In";
      }
    }, 600); // simulated network delay for realistic UX
  });
});