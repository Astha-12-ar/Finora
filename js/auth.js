document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, redirect to dashboard
  if (typeof getToken === "function" && getToken()) {
    window.location.href = "dashboard.html";
    return;
  }

  // Tabs
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  // Login form elements
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const loginBtn = document.getElementById("loginBtn");

  // Register form elements
  const regNameInput = document.getElementById("regName");
  const regEmailInput = document.getElementById("regEmail");
  const regPasswordInput = document.getElementById("regPassword");
  const regConfirmPasswordInput = document.getElementById("regConfirmPassword");
  const regNameError = document.getElementById("regNameError");
  const regEmailError = document.getElementById("regEmailError");
  const regPasswordError = document.getElementById("regPasswordError");
  const regConfirmError = document.getElementById("regConfirmError");
  const regGlobalError = document.getElementById("regGlobalError");
  const regSuccess = document.getElementById("regSuccess");
  const registerBtn = document.getElementById("registerBtn");

  // Tab switching logic
  function clearAllErrors() {
    if (emailError) emailError.textContent = "";
    if (passwordError) passwordError.textContent = "";
    if (regNameError) regNameError.textContent = "";
    if (regEmailError) regEmailError.textContent = "";
    if (regPasswordError) regPasswordError.textContent = "";
    if (regConfirmError) regConfirmError.textContent = "";
    if (regGlobalError) regGlobalError.textContent = "";
    if (regSuccess) {
      regSuccess.textContent = "";
      regSuccess.classList.add("hidden");
    }
  }

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener("click", () => {
      tabLogin.classList.add("active");
      tabLogin.setAttribute("aria-selected", "true");
      tabRegister.classList.remove("active");
      tabRegister.setAttribute("aria-selected", "false");
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
      clearAllErrors();
    });

    tabRegister.addEventListener("click", () => {
      tabRegister.classList.add("active");
      tabRegister.setAttribute("aria-selected", "true");
      tabLogin.classList.remove("active");
      tabLogin.setAttribute("aria-selected", "false");
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
      clearAllErrors();
    });
  }

  // Email format regex helper
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ---------------- LOGIN FORM HANDLER ----------------
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    emailError.textContent = "";
    passwordError.textContent = "";

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    let isValid = true;

    // Email format check
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

  // ---------------- REGISTER FORM HANDLER ----------------
  if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearAllErrors();

      const name = regNameInput.value.trim();
      const email = regEmailInput.value.trim().toLowerCase();
      const password = regPasswordInput.value;
      const confirmPassword = regConfirmPasswordInput.value;
      let isValid = true;

      if (!name) {
        regNameError.textContent = "Full name is required.";
        isValid = false;
      }

      if (!emailPattern.test(email)) {
        regEmailError.textContent = "Enter a valid email address.";
        isValid = false;
      }

      if (password.length < 6) {
        regPasswordError.textContent = "Password must be at least 6 characters.";
        isValid = false;
      }

      if (password !== confirmPassword) {
        regConfirmError.textContent = "Passwords do not match.";
        isValid = false;
      }

      if (!isValid) return;

      registerBtn.disabled = true;
      registerBtn.textContent = "Creating Account...";

      try {
        const res = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password })
        });

        if (res && res.data && res.data.token) {
          regSuccess.textContent = "Account created successfully! Redirecting...";
          regSuccess.classList.remove("hidden");

          setToken(res.data.token);
          setUser(res.data.user);
          localStorage.removeItem("finora_session");

          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 800);
        } else {
          throw new Error("Invalid registration response from server.");
        }
      } catch (err) {
        registerBtn.disabled = false;
        registerBtn.textContent = "Create Account";

        if (err.status === 409) {
          regEmailError.textContent = "This email is already registered.";
        } else if (err.status === 400 && err.details && err.details.length) {
          // Show field specific error from Zod validation
          const detail = err.details[0];
          if (detail.field.includes("email")) {
            regEmailError.textContent = detail.message;
          } else if (detail.field.includes("password")) {
            regPasswordError.textContent = detail.message;
          } else if (detail.field.includes("name")) {
            regNameError.textContent = detail.message;
          } else {
            regGlobalError.textContent = detail.message;
          }
        } else if (err.status === 429) {
          regGlobalError.textContent = "Too many attempts. Please try again later.";
        } else if (err.isNetworkError || err.status === 0) {
          regGlobalError.textContent = "Unable to connect to the server. Please try again.";
        } else {
          regGlobalError.textContent = err.message || "Registration failed. Please try again.";
        }
      }
    });
  }
});