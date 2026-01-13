/**
 * Simple Password Protection
 * Change the password below to your preferred password
 */
(function() {
  // ========== EDIT YOUR PASSWORD HERE ==========
  const SITE_PASSWORD = 'REDACTED';
  // =============================================

  const AUTH_KEY = 'site_authenticated';

  // Artwork URL for background
  const ARTWORK_URL = 'https://cdn.feralfileassets.com/previews/500ccc6e-d7ad-443f-a9df-0bf709b3b3c9/1645052262/index.html';

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }

  function showPasswordPrompt() {
    // Create overlay with artwork background
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <!-- Artwork Background -->
      <div class="auth-artwork-bg">
        <iframe src="${ARTWORK_URL}" title="Background Artwork" loading="eager"></iframe>
      </div>

      <!-- Password Modal -->
      <div class="auth-modal">
        <p class="auth-snark">why u sneaking 'round?</p>
        <form id="auth-form">
          <input type="password" id="auth-password" placeholder="password" autocomplete="off" required>
          <button type="submit">enter</button>
          <p id="auth-error">nope, try again</p>
        </form>
      </div>

      <!-- Art Credit -->
      <div class="auth-art-credit">
        <span class="credit-label">artwork</span>
        <span class="credit-title">36 Points</span>
        <span class="credit-artist">Sage Jenson</span>
      </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.id = 'auth-styles';
    styles.textContent = `
      #auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 99999;
        font-family: var(--font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      }

      /* Artwork Background */
      .auth-artwork-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
      }

      .auth-artwork-bg iframe {
        width: 100%;
        height: 100%;
        border: none;
        pointer-events: none;
      }

      /* Password Modal */
      .auth-modal {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;
      }

      .auth-snark {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.875rem;
        margin-bottom: 2rem;
        letter-spacing: 0.05em;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      }

      #auth-form {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        width: 100%;
        max-width: 280px;
      }

      #auth-password {
        width: 100%;
        padding: 1rem 1.25rem;
        font-size: 1rem;
        font-family: inherit;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        text-align: center;
        letter-spacing: 0.1em;
        transition: border-color 0.2s, background 0.2s;
      }

      #auth-password::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }

      #auth-password:focus {
        outline: none;
        border-color: rgba(255, 255, 255, 0.4);
        background: rgba(0, 0, 0, 0.5);
      }

      #auth-form button {
        width: 100%;
        padding: 1rem 1.25rem;
        font-size: 0.875rem;
        font-family: inherit;
        text-transform: lowercase;
        letter-spacing: 0.15em;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
        color: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      #auth-form button:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }

      #auth-error {
        color: rgba(255, 100, 100, 0.9);
        font-size: 0.8rem;
        margin-top: 0.5rem;
        opacity: 0;
        transition: opacity 0.2s;
      }

      #auth-error.visible {
        opacity: 1;
      }

      /* Art Credit Box */
      .auth-art-credit {
        position: absolute;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.25rem;
        padding: 1rem 1.25rem;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(16px);
        border-radius: 8px;
        text-align: right;
      }

      .credit-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: rgba(255, 255, 255, 0.4);
      }

      .credit-title {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
      }

      .credit-artist {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
      }

      /* Mobile adjustments */
      @media (max-width: 480px) {
        .auth-art-credit {
          bottom: 1rem;
          right: 1rem;
          padding: 0.75rem 1rem;
        }
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(overlay);

    // Hide page content and scrolling
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
        // Dispatch event to trigger intro animation
        window.dispatchEvent(new CustomEvent('auth-complete'));
      } else {
        error.classList.add('visible');
        input.value = '';
        input.focus();
        // Hide error after a moment
        setTimeout(() => error.classList.remove('visible'), 2000);
      }
    });

    // Focus input
    setTimeout(() => {
      document.getElementById('auth-password').focus();
    }, 100);
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
