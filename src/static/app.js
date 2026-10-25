document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const adminToggle = document.getElementById("admin-toggle");
  const adminMenu = document.getElementById("admin-menu");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminLogoutButton = document.getElementById("admin-logout");
  const adminUsernameInput = document.getElementById("admin-username");
  const adminPasswordInput = document.getElementById("admin-password");
  const signupStatus = document.getElementById("signup-status");

  const isTeacherLoggedIn = () => Boolean(sessionStorage.getItem("mergington-admin-token"));

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAdminUI() {
    const token = sessionStorage.getItem("mergington-admin-token");
    const username = sessionStorage.getItem("mergington-admin-username");
    const teacherLoggedIn = Boolean(token);

    adminToggle.textContent = teacherLoggedIn ? `👤 ${username}` : "👤";
    adminToggle.title = teacherLoggedIn ? `Logged in as ${username}` : "Teacher login";
    adminLogoutButton.classList.toggle("hidden", !teacherLoggedIn);

    signupForm.classList.toggle("teacher-only-disabled", !teacherLoggedIn);
    signupForm.querySelector("button").disabled = !teacherLoggedIn;

    if (teacherLoggedIn) {
      signupStatus.textContent = `Logged in as ${username}. You can register and unregister students.`;
    } else {
      signupStatus.textContent = "Log in as a teacher to register or unregister students.";
    }

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.classList.toggle("hidden", !teacherLoggedIn);
    });
  }

  async function checkAdminSession() {
    const token = sessionStorage.getItem("mergington-admin-token");
    if (!token) {
      updateAdminUI();
      return;
    }

    try {
      const response = await fetch("/admin/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (!response.ok || !result.logged_in) {
        sessionStorage.removeItem("mergington-admin-token");
        sessionStorage.removeItem("mergington-admin-username");
      }
    } catch (error) {
      console.error("Failed to verify admin session:", error);
    }

    updateAdminUI();
  }

  adminToggle.addEventListener("click", () => {
    if (!isTeacherLoggedIn()) {
      adminMenu.classList.toggle("hidden");
      if (!adminMenu.classList.contains("hidden")) {
        adminUsernameInput.focus();
      }
      return;
    }

    adminMenu.classList.toggle("hidden");
  });

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = adminUsernameInput.value.trim();
    const password = adminPasswordInput.value;

    try {
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Invalid username or password.", "error");
        return;
      }

      sessionStorage.setItem("mergington-admin-token", result.token);
      sessionStorage.setItem("mergington-admin-username", result.username);
      adminMenu.classList.add("hidden");
      adminLoginForm.reset();
      updateAdminUI();
      showMessage(`Logged in as ${result.username}.`, "success");
      fetchActivities();
    } catch (error) {
      console.error("Login failed:", error);
      showMessage("Unable to log in. Please try again.", "error");
    }
  });

  adminLogoutButton.addEventListener("click", async () => {
    const token = sessionStorage.getItem("mergington-admin-token");
    if (!token) {
      return;
    }

    try {
      await fetch("/admin/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }

    sessionStorage.removeItem("mergington-admin-token");
    sessionStorage.removeItem("mergington-admin-username");
    adminMenu.classList.add("hidden");
    updateAdminUI();
    showMessage("Logged out successfully.", "info");
    fetchActivities();
  });

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    const deleteButton = isTeacherLoggedIn()
                      ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                      : "";
                    return `<li><span class="participant-email">${email}</span>${deleteButton}</li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");
    const token = sessionStorage.getItem("mergington-admin-token");

    if (!token) {
      showMessage("Teacher login required to unregister students.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred.", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = sessionStorage.getItem("mergington-admin-token");
    if (!token) {
      showMessage("Teacher login required to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred.", "error");
      }
    } catch (error) {
      showMessage("Failed to register the student. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  checkAdminSession();
  fetchActivities();
});
