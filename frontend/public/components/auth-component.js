// 🔐 YATWA Auth Component - User Authentication UI
// Handles registration and hash verification with beautiful UI

class AuthComponent extends HTMLElement {
    constructor() {
        super();

        this.state = {
            step: 'welcome', // 'welcome' | 'register' | 'verify' | 'success'
            loading: false,
            email: '',
            hash: '',
            error: null,
            emailOptional: true,
            showAdvanced: false
        };

        this.apiService = null;
    }

    /* ============================================================================
       LIFECYCLE METHODS
       ============================================================================ */

    async connectedCallback() {
        try {
            // Get API service from global app
            this.apiService = window.app?.services?.api;
            if (!this.apiService) {
                throw new Error('API service not available');
            }

            this.render();
            this.setupEventListeners();

            // Check if we should auto-focus email input
            setTimeout(() => this.autoFocus(), 100);

        } catch (error) {
            console.error('🔐 Auth component initialization failed:', error);
            this.setState({ error: 'Failed to initialize authentication' });
        }
    }

    disconnectedCallback() {
        this.cleanup();
    }

    /* ============================================================================
       STATE MANAGEMENT
       ============================================================================ */

    setState(newState) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...newState };

        // Re-render if needed
        if (this.shouldRerender(prevState, this.state)) {
            this.render();
            this.setupEventListeners();
        }
    }

    shouldRerender(prevState, newState) {
        const rerenderProps = ['step', 'loading', 'error', 'showAdvanced'];
        return rerenderProps.some(prop => prevState[prop] !== newState[prop]);
    }

    /* ============================================================================
       RENDERING
       ============================================================================ */

    render() {
        this.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <!-- Header -->
          <div class="auth-header">
            <div class="auth-logo">🗓️</div>
            <h1 class="auth-title">YATWA</h1>
            <p class="auth-subtitle">Yet Another Trash Web App</p>
          </div>

          <!-- Progress Steps -->
          ${this.renderProgressSteps()}

          <!-- Content -->
          <div class="auth-content">
            ${this.renderStepContent()}
          </div>

          <!-- Footer -->
          <div class="auth-footer">
            ${this.renderFooter()}
          </div>
        </div>

        <!-- Background Animation -->
        <div class="auth-background">
          <div class="floating-icons">
            <span class="floating-icon" style="--delay: 0s;">📅</span>
            <span class="floating-icon" style="--delay: 2s;">⏰</span>
            <span class="floating-icon" style="--delay: 4s;">📝</span>
            <span class="floating-icon" style="--delay: 6s;">🔔</span>
            <span class="floating-icon" style="--delay: 8s;">📊</span>
          </div>
        </div>
      </div>

      <style>
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 80vh;
          padding: 2rem;
          position: relative;
        }

        .auth-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-2xl);
          padding: 3rem;
          max-width: 480px;
          width: 100%;
          position: relative;
          z-index: 2;
          backdrop-filter: blur(10px);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .auth-logo {
          font-size: 4rem;
          margin-bottom: 1rem;
          animation: bounce 2s infinite;
        }

        .auth-title {
          font-size: var(--font-size-3xl);
          font-weight: 700;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: var(--font-size-lg);
          margin: 0;
        }

        .progress-steps {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
          position: relative;
        }

        .step {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: var(--radius-full);
          font-weight: 600;
          font-size: var(--font-size-sm);
          transition: all var(--transition);
          position: relative;
        }

        .step.active {
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          transform: scale(1.1);
        }

        .step.completed {
          background: var(--success);
          color: white;
        }

        .step.inactive {
          background: var(--bg-tertiary);
          color: var(--text-tertiary);
        }

        .step-connector {
          width: 3rem;
          height: 2px;
          background: var(--border-color);
          margin: 0 0.5rem;
        }

        .step-connector.completed {
          background: var(--success);
        }

        .auth-content {
          margin-bottom: 2rem;
        }

        .step-title {
          font-size: var(--font-size-xl);
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 1rem;
          text-align: center;
        }

        .step-description {
          color: var(--text-secondary);
          text-align: center;
          margin-bottom: 2rem;
          line-height: var(--line-height-relaxed);
        }

        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin: 2rem 0;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: var(--radius);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }

        .feature-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          font-size: var(--font-size-sm);
        }

        .form-input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 2px solid var(--border-color);
          border-radius: var(--radius);
          font-size: var(--font-size-base);
          background: var(--bg-primary);
          color: var(--text-primary);
          transition: all var(--transition-fast);
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-help {
          font-size: var(--font-size-sm);
          color: var(--text-tertiary);
          margin-top: 0.5rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: var(--radius);
          font-size: var(--font-size-lg);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          position: relative;
          overflow: hidden;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-secondary);
          border: 2px solid var(--border-color);
          padding: 0.75rem 1.5rem;
          border-radius: var(--radius);
          font-size: var(--font-size-base);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-secondary:hover {
          background: var(--bg-secondary);
          border-color: var(--primary);
          color: var(--text-primary);
        }

        .loading-spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-left: 2px solid white;
          border-radius: var(--radius-full);
          animation: spin 1s linear infinite;
          margin-right: 0.5rem;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius);
          padding: 1rem;
          margin-bottom: 1rem;
          color: var(--error);
          font-size: var(--font-size-sm);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .success-message {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: var(--radius);
          padding: 1rem;
          margin-bottom: 1rem;
          color: var(--success);
          font-size: var(--font-size-sm);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .hash-display {
          background: var(--bg-tertiary);
          border: 2px dashed var(--border-color);
          border-radius: var(--radius);
          padding: 1rem;
          margin: 1rem 0;
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          word-break: break-all;
          position: relative;
        }

        .copy-button {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .copy-button:hover {
          background: var(--primary-dark);
        }

        .advanced-options {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .advanced-toggle {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
          cursor: pointer;
          text-decoration: underline;
          margin-bottom: 1rem;
        }

        .auth-footer {
          text-align: center;
          font-size: var(--font-size-sm);
          color: var(--text-tertiary);
        }

        .auth-footer a {
          color: var(--primary);
          text-decoration: none;
        }

        .auth-footer a:hover {
          text-decoration: underline;
        }

        .auth-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 1;
          opacity: 0.1;
        }

        .floating-icons {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .floating-icon {
          position: absolute;
          font-size: 2rem;
          animation: float 6s ease-in-out infinite;
          animation-delay: var(--delay);
        }

        .floating-icon:nth-child(1) { top: 20%; left: 10%; }
        .floating-icon:nth-child(2) { top: 60%; left: 80%; }
        .floating-icon:nth-child(3) { top: 30%; left: 70%; }
        .floating-icon:nth-child(4) { top: 70%; left: 20%; }
        .floating-icon:nth-child(5) { top: 10%; left: 50%; }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }

        @media (max-width: 640px) {
          .auth-container {
            padding: 1rem;
          }

          .auth-card {
            padding: 2rem 1.5rem;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .floating-icons {
            display: none;
          }
        }
      </style>
    `;
    }

    renderProgressSteps() {
        if (this.state.step === 'welcome') {
            return '';
        }

        const steps = [
            { id: 'register', label: '1', title: 'Start' },
            { id: 'verify', label: '2', title: 'Setup' },
            { id: 'success', label: '✓', title: 'Ready' }
        ];

        const currentIndex = steps.findIndex(step => step.id === this.state.step);

        return `
      <div class="progress-steps">
        ${steps.map((step, index) => `
          <div class="step ${
            index < currentIndex ? 'completed' :
                index === currentIndex ? 'active' :
                    'inactive'
        }">
            ${step.label}
          </div>
          ${index < steps.length - 1 ? `
            <div class="step-connector ${index < currentIndex ? 'completed' : ''}"></div>
          ` : ''}
        `).join('')}
      </div>
    `;
    }

    renderStepContent() {
        switch (this.state.step) {
            case 'welcome':
                return this.renderWelcomeStep();
            case 'register':
                return this.renderRegisterStep();
            case 'verify':
                return this.renderVerifyStep();
            case 'success':
                return this.renderSuccessStep();
            default:
                return '<div>Unknown step</div>';
        }
    }

    renderWelcomeStep() {
        return `
      <div class="step-title">Welcome to Simple Calendar Management!</div>
      <div class="step-description">
        Create your personal calendar without registration. No passwords, no hassle – just pure simplicity.
      </div>

      <div class="features-grid">
        <div class="feature-item">
          <span class="feature-icon">🔐</span>
          <span>No passwords needed</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">📅</span>
          <span>Custom event icons</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">🔄</span>
          <span>Device synchronization</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">📧</span>
          <span>Optional email delivery</span>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-primary" data-action="start">
          🚀 Get Started
        </button>
        <button class="btn-secondary" data-action="verify">
          🔗 I have a link
        </button>
      </div>
    `;
    }

    renderRegisterStep() {
        return `
      <div class="step-title">Create Your Calendar</div>
      <div class="step-description">
        We'll generate a secure link for your calendar. Email is optional – you can get the link immediately.
      </div>

      ${this.state.error ? `
        <div class="error-message">
          <span>⚠️</span>
          <span>${this.state.error}</span>
        </div>
      ` : ''}

      <form data-form="register">
        <div class="form-group">
          <label class="form-label" for="email">
            Email Address (Optional)
          </label>
          <input
            type="email"
            id="email"
            name="email"
            class="form-input"
            placeholder="your@email.com"
            value="${this.state.email}"
          >
          <div class="form-help">
            💡 Leave empty to get your calendar link immediately, or enter email to receive it by mail.
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary" ${this.state.loading ? 'disabled' : ''}>
            ${this.state.loading ? '<span class="loading-spinner"></span>' : '📅'}
            ${this.state.loading ? 'Creating Calendar...' : 'Create My Calendar'}
          </button>
          <button type="button" class="btn-secondary" data-action="back">
            ← Back
          </button>
        </div>
      </form>
    `;
    }

    renderVerifyStep() {
        return `
      <div class="step-title">Access Your Calendar</div>
      <div class="step-description">
        Enter your calendar link or hash to access your existing calendar.
      </div>

      ${this.state.error ? `
        <div class="error-message">
          <span>⚠️</span>
          <span>${this.state.error}</span>
        </div>
      ` : ''}

      <form data-form="verify">
        <div class="form-group">
          <label class="form-label" for="hash">
            Calendar Link or Hash
          </label>
          <input
            type="text"
            id="hash"
            name="hash"
            class="form-input"
            placeholder="Paste your calendar link or hash here"
            value="${this.state.hash}"
            required
          >
          <div class="form-help">
            📎 Paste the complete link from your email or just the hash part.
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary" ${this.state.loading ? 'disabled' : ''}>
            ${this.state.loading ? '<span class="loading-spinner"></span>' : '🔓'}
            ${this.state.loading ? 'Verifying...' : 'Access Calendar'}
          </button>
          <button type="button" class="btn-secondary" data-action="back">
            ← Back
          </button>
        </div>
      </form>
    `;
    }

    renderSuccessStep() {
        return `
      <div class="step-title">🎉 Calendar Ready!</div>
      <div class="step-description">
        Your calendar has been created successfully. Save your secure link below.
      </div>

      <div class="success-message">
        <span>✅</span>
        <span>Your personal calendar is now ready to use!</span>
      </div>

      ${this.state.hash ? `
        <div class="hash-display">
          <div style="font-weight: 600; margin-bottom: 0.5rem;">Your secure link:</div>
          ${this.state.hash}
          <button class="copy-button" data-action="copy">Copy</button>
        </div>
      ` : ''}

      <div class="form-actions">
        <button class="btn-primary" data-action="continue">
          📅 Go to Calendar
        </button>
      </div>
    `;
    }

    renderFooter() {
        return `
      <div>
        Secure • Private • Simple
      </div>
    `;
    }

    /* ============================================================================
       EVENT HANDLING
       ============================================================================ */

    setupEventListeners() {
        // Action buttons
        this.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = e.target.getAttribute('data-action');
                this.handleAction(action);
            });
        });

        // Forms
        this.querySelectorAll('[data-form]').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formType = e.target.getAttribute('data-form');
                this.handleFormSubmit(formType, new FormData(e.target));
            });
        });

        // Input changes
        this.querySelectorAll('.form-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.state[e.target.name] = e.target.value;
            });
        });
    }

    handleAction(action) {
        switch (action) {
            case 'start':
                this.setState({ step: 'register', error: null });
                break;
            case 'verify':
                this.setState({ step: 'verify', error: null });
                break;
            case 'back':
                this.setState({ step: 'welcome', error: null });
                break;
            case 'copy':
                this.copyHashToClipboard();
                break;
            case 'continue':
                this.handleAuthSuccess();
                break;
        }
    }

    async handleFormSubmit(formType, formData) {
        switch (formType) {
            case 'register':
                await this.handleRegister(formData);
                break;
            case 'verify':
                await this.handleVerify(formData);
                break;
        }
    }

    async handleRegister(formData) {
        this.setState({ loading: true, error: null });

        try {
            const email = formData.get('email') || null;
            const response = await this.apiService.register(email);

            if (response.success) {
                this.setState({
                    loading: false,
                    step: 'success',
                    hash: response.hash
                });
            } else {
                throw new Error(response.error || 'Registration failed');
            }

        } catch (error) {
            console.error('Registration error:', error);
            this.setState({
                loading: false,
                error: error.message || 'Registration failed. Please try again.'
            });
        }
    }

    async handleVerify(formData) {
        this.setState({ loading: true, error: null });

        try {
            let hash = formData.get('hash');

            // Extract hash from URL if full link was provided
            if (hash.includes('?hash=')) {
                hash = new URL(hash).searchParams.get('hash');
            }

            if (!hash) {
                throw new Error('Please enter a valid hash or link');
            }

            const response = await this.apiService.verifyHash(hash);

            if (response.success) {
                this.setState({
                    loading: false,
                    hash: hash
                });

                // Dispatch success event immediately
                this.dispatchAuthSuccess(hash, response.user);
            } else {
                throw new Error(response.error || 'Invalid hash or link');
            }

        } catch (error) {
            console.error('Verification error:', error);
            this.setState({
                loading: false,
                error: error.message || 'Verification failed. Please check your link.'
            });
        }
    }

    handleAuthSuccess() {
        if (this.state.hash) {
            this.dispatchAuthSuccess(this.state.hash, { hash: this.state.hash });
        }
    }

    dispatchAuthSuccess(hash, user) {
        window.dispatchEvent(new CustomEvent('yatwa-auth-success', {
            detail: { hash, user }
        }));
    }

    async copyHashToClipboard() {
        if (!this.state.hash) return;

        try {
            await navigator.clipboard.writeText(this.state.hash);

            // Visual feedback
            const button = this.querySelector('[data-action="copy"]');
            if (button) {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.background = 'var(--success)';

                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = 'var(--primary)';
                }, 2000);
            }

        } catch (error) {
            console.error('Failed to copy hash:', error);
        }
    }

    autoFocus() {
        const input = this.querySelector('.form-input');
        if (input && !this.state.loading) {
            input.focus();
        }
    }

    cleanup() {
        // Remove any event listeners if needed
    }
}

// Register the component
customElements.define('auth-component', AuthComponent);