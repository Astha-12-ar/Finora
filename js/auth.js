document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, redirect to dashboard
  if (typeof getToken === "function" && getToken()) {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const loginBtn = document.getElementById("loginBtn");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    emailError.textContent = "";
    passwordError.textContent = "";

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    let isValid = true;

    // Email format check
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      emailError.textContent = "Enter a valid email address.";
      isValid = false;
    }

    // Password check
    if (password.length < 1) {
      passwordError.textContent = "Password is required.";
      isValid = false;
    }

    if (!isValid) return;

    // Loading state
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      if (res && res.data && res.data.token) {
        setToken(res.data.token);
        setUser(res.data.user);
        // Clear old fake session if it exists
        localStorage.removeItem("finora_session");
        window.location.href = "dashboard.html";
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (err) {
      loginBtn.disabled = false;
      loginBtn.textContent = "Log In";

      if (err.status === 401) {
        passwordError.textContent = "Invalid email or password.";
      } else if (err.status === 429) {
        passwordError.textContent = "Too many attempts. Please try again later.";
      } else if (err.isNetworkError || err.status === 0) {
        passwordError.textContent = "Unable to connect to the server. Please try again.";
      } else {
        passwordError.textContent = err.message || "Login failed. Please try again.";
      }
    }
  });
});