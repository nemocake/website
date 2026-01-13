/**
 * Simple Password Protection
 * Change the password below to your preferred password
 */
(function() {
  // ========== EDIT YOUR PASSWORD HERE ==========
  const SITE_PASSWORD = 'REDACTED';
  // =============================================

  const AUTH_KEY = 'site_authenticated';

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }

  function showPasswordPrompt() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <h2>Password Required</h2>
        <p>Enter the password to access this site.</p>
        <form id="auth-form">
          <input type="password" id="auth-password" placeholder="Password" autocomplete="off" required>
          <button type="submit">Enter</button>
          <p id="auth-error" style="display: none; color: #e74c3c; margin-top: 1rem;">Incorrect password</p>
        </form>
      </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      #auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--color-background, #ffffff);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: var(--font-family, sans-serif);
      }
      .auth-modal {
        text-align: center;
        padding: 3rem;
        max-width: 400px;
      }
      .auth-modal h2 {
        margin-bottom: 0.5rem;
        font-weight: 600;
      }
      .auth-modal p {
        color: var(--color-text-muted, #666);
        margin-bottom: 1.5rem;
      }
      #auth-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      #auth-password {
        padding: 0.75rem 1rem;
        font-size: 1rem;
        border: 1px solid var(--color-border, #ddd);
        border-radius: 4px;
        text-align: center;
      }
      #auth-password:focus {
        outline: none;
        border-color: var(--color-accent, #0984e3);
      }
      #auth-form button {
        padding: 0.75rem 1rem;
        font-size: 1rem;
        background: var(--color-text, #2d3436);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      #auth-form button:hover {
        opacity: 0.9;
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(overlay);

    // Hide page content
    document.body.style.overflow = 'hidden';

    // Handle form submit
    document.getElementById('auth-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const input = document.getElementById('auth-password');
      const error = document.getElementById('auth-error');

      if (input.value === SITE_PASSWORD) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        overlay.remove();
        styles.remove();
        document.body.style.overflow = '';
      } else {
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    });

    // Focus input
    document.getElementById('auth-password').focus();
  }

  // Check auth on page load
  if (!isAuthenticated()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showPasswordPrompt);
    } else {
      showPasswordPrompt();
    }
  }
})();
