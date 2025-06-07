// 📅 YATWA Calendar Component - Event Management & Calendar Views
// Handles event creation, editing, calendar display and iCal export

class CalendarComponent extends HTMLElement {
    constructor() {
        super();

        this.state = {
            // View state
            currentView: 'month', // 'month' | 'week' | 'list'
            currentDate: new Date(),
            selectedDate: null,

            // Events
            events: [],
            selectedEvent: null,

            viewFilter: 'upcoming', // 'upcoming' | 'past' | 'today' | 'all'

            // Dialog states
            showEventDialog: false,
            showDeleteConfirm: false,
            showExportDialog: false,

            // Form state
            eventForm: {
                id: null,
                title: '',
                description: '',
                event_date: '',
                event_time: '',
                icon: '📅',
                category: 'general',
                all_day: false,
                reminder_minutes: 0
            },

            // UI state
            loading: false,
            error: null,
            draggedEvent: null
        };

        // Available icons for events
        this.eventIcons = [
            '📅', '🗓️', '⏰', '🔔', '📝', '💼', '🏠', '🚗', '✈️', '🎉',
            '🍽️', '💊', '🏥', '🎓', '💪', '🛒', '📞', '💻', '🎵', '📚',
            '🧹', '🗑️', '♻️', '🚮', '🏃', '🎯', '💡', '⭐', '❤️', '🎁'
        ];

        // Event categories
        this.eventCategories = [
            { id: 'general', name: 'Allgemein', color: '#667eea' },
            { id: 'work', name: 'Arbeit', color: '#f59e0b' },
            { id: 'personal', name: 'Persönlich', color: '#10b981' },
            //{ id: 'health', name: 'Gesundheit', color: '#ef4444' },
            { id: 'maintenance', name: 'Wartung', color: '#6b7280' },
            { id: 'trash', name: 'Müll & Entsorgung', color: '#8b5cf6' },
        ];

        this.apiService = null;
        this.storageService = null;
    }

    /* ============================================================================
       LIFECYCLE METHODS
       ============================================================================ */

    async connectedCallback() {
        try {
            // Get services from global app
            this.apiService = window.app?.services?.api;
            this.storageService = window.app?.services?.storage;

            if (!this.apiService) {
                throw new Error('API service not available');
            }

            // Load initial data
            await this.loadEvents();

            this.render();
            this.setupEventListeners();

            console.log('📅 Calendar component initialized');

        } catch (error) {
            console.error('📅 Calendar component initialization failed:', error);
            this.setState({ error: 'Failed to initialize calendar' });
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

    /**
     * Determines whether the component should re-render based on state changes.
     *
     * This is a performance optimization that prevents unnecessary DOM updates
     * by only re-rendering when specific UI-relevant state properties change.
     * Similar to React's shouldComponentUpdate() or React.memo().
     *
     * @param {Object} prevState - The previous component state before the update
     * @param {Object} newState - The new component state after the update
     * @returns {boolean} True if the component should re-render, false otherwise
     *
     * @example
     * // Will trigger re-render (dialog state changed)
     * this.setState({ showEventDialog: true });
     *
     * @example
     * // Will NOT trigger re-render (form input doesn't affect UI)
     * this.setState({ eventForm: { ...form, title: 'New Title' } });
     *
     * @performance
     * - Prevents unnecessary DOM manipulations during form input
     * - Avoids re-setting event listeners on every state change
     * - Reduces flicker and improves perceived performance
     *
     * @see {@link setState} - The method that calls shouldRerender()
     * @since 1.0.0
     */
    shouldRerender(prevState, newState) {
        /**
         * Properties that require a UI re-render when changed.
         * Only these state changes will trigger expensive DOM operations.
         *
         * @type {string[]}
         * @const
         */
        const rerenderProps = [
            'showEventDialog',    // Event creation/edit dialog visibility
            'showDeleteConfirm',  // Delete confirmation dialog visibility
            'showExportDialog',   // Export/iCal dialog visibility
            'loading',            // Loading state for spinners/disabled buttons
            'error',              // Error messages display
            'currentView',        // Calendar view mode (month/week/list)
            'events',             // Events array - affects main content
            'viewFilter',         // Event filter (past/upcoming/all) - affects displayed events
            'eventForm'
        ];

        return rerenderProps.some(prop => prevState[prop] !== newState[prop]);
    }

    /* ============================================================================
       DATA MANAGEMENT
       ============================================================================ */

    async loadEvents() {
        const userHash = window.app?.state?.userHash;
        if (!userHash) return;

        try {
            this.setState({ loading: true });

            const events = await this.apiService.getEvents(userHash);
            this.setState({
                events,
                loading: false,
                error: null
            });

            console.log('📅 Loaded events:', events.length);

        } catch (error) {
            console.error('Failed to load events:', error);
            this.setState({
                loading: false,
                error: 'Failed to load events'
            });
        }
    }

    /* ============================================================================
       RENDERING
       ============================================================================ */

    render() {
        this.innerHTML = `
            <div class="calendar-container">
                <!-- Calendar Header -->
                ${this.renderCalendarHeader()}

                <!-- Main Calendar Content -->
                <div class="calendar-content">
                    ${this.renderCalendarView()}
                </div>

                <!-- Event Creation/Edit Dialog -->
                ${this.state.showEventDialog ? this.renderEventDialog() : ''}

                <!-- Delete Confirmation Dialog -->
                ${this.state.showDeleteConfirm ? this.renderDeleteConfirmDialog() : ''}

                <!-- Export Dialog -->
                ${this.state.showExportDialog ? this.renderExportDialog() : ''}

                <!-- Loading Overlay -->
                ${this.state.loading ? this.renderLoadingOverlay() : ''}
            </div>

            ${this.renderStyles()}
        `;
    }

    renderCalendarHeader() {
        return `
            <div class="calendar-header">
                <div class="calendar-nav">
                    <div class="date-navigation">
                        <button class="btn btn-ghost btn-sm" data-action="show-past">
                            ← Vergangene
                        </button>
                        <h2 class="current-view-title">
                            ${this.getViewTitle()}
                        </h2>
                        <button class="btn btn-ghost btn-sm" data-action="show-all">
                            Alle anzeigen →
                        </button>
                    </div>

                    <div class="calendar-actions">
                        <button class="btn btn-primary" data-action="add-event">
                            ➕ Neuer Termin
                        </button>
                        <button class="btn btn-secondary" data-action="show-today">
                            📅 Heute
                        </button>
                        <button class="btn btn-ghost" data-action="export" title="Kalender exportieren">
                            📊 Export
                        </button>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="calendar-stats">
                    <div class="stat-item">
                        <span class="stat-icon">📅</span>
                        <span class="stat-text">${this.state.events.length} Termine</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">⏰</span>
                        <span class="stat-text">${this.getUpcomingEventsCount()} bevorstehend</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderCalendarView() {
        return `
            <div class="calendar-view-container">
                <div class="events-list">
                    ${this.renderEventsForCurrentView()}
                </div>
            </div>
        `;
    }

    renderEventsForCurrentView() {
        const filteredEvents = this.getFilteredEventsForView();

        return `
            <div class="events-grid">
                ${filteredEvents.map(event => this.renderEventCard(event)).join('')}
            </div>
        `;
    }

    renderEventCard(event) {
        const eventDate = new Date(event.event_date);
        const isToday = this.isToday(eventDate);
        const isPast = eventDate < new Date() && !isToday;
        const category = this.eventCategories.find(cat => cat.id === event.category) || this.eventCategories[0];

        return `
            <div class="event-card ${isPast ? 'event-past' : ''} ${isToday ? 'event-today' : ''}" 
                 data-event-id="${event.id}">
                <div class="event-card-header">
                    <div class="event-icon-category">
                        <span class="event-icon">${event.icon || '📅'}</span>
                        <span class="event-category" style="background-color: ${category.color}20; color: ${category.color}">
                            ${category.name}
                        </span>
                    </div>
                    <div class="event-actions">
                        <button class="btn-icon" data-action="edit-event" data-event-id="${event.id}" title="Bearbeiten">
                            ✏️
                        </button>
                        <button class="btn-icon" data-action="delete-event" data-event-id="${event.id}" title="Löschen">
                            🗑️
                        </button>
                    </div>
                </div>

                <div class="event-card-body">
                    <h3 class="event-title">${this.escapeHtml(event.title)}</h3>
                    ${event.description ? `<p class="event-description">${this.escapeHtml(event.description)}</p>` : ''}
                    
                    <div class="event-datetime">
                        <span class="event-date">
                            📅 ${this.formatEventDate(eventDate)}
                        </span>
                        ${event.event_time ? `
                            <span class="event-time">
                                ⏰ ${event.event_time}
                            </span>
                        ` : ''}
                        ${event.all_day ? '<span class="event-all-day">Ganztägig</span>' : ''}
                    </div>

                    ${event.reminder_minutes > 0 ? `
                        <div class="event-reminder">
                            🔔 Erinnerung ${event.reminder_minutes} Min. vorher
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderEventDialog() {
        const isEditing = this.state.eventForm.id !== null;
        const dialogTitle = isEditing ? 'Termin bearbeiten' : 'Neuer Termin';

        return `
            <div class="dialog-overlay" data-action="close-dialog">
                <div class="dialog-container event-dialog" onclick="event.stopPropagation()">
                    <div class="dialog-header">
                        <h2 class="dialog-title">${dialogTitle}</h2>
                        <button class="dialog-close" data-action="close-dialog">✕</button>
                    </div>

                    <form class="dialog-body" data-form="event">
                        <!-- Titel -->
                        <div class="form-group">
                            <label class="form-label" for="event-title">
                                Titel *
                            </label>
                            <input
                                type="text"
                                id="event-title"
                                name="title"
                                class="form-input"
                                placeholder="z.B. Gelbe Tonne rausstellen"
                                value="${this.escapeHtml(this.state.eventForm.title)}"
                                required
                                maxlength="100"
                            >
                        </div>

                        <!-- Beschreibung -->
                        <div class="form-group">
                            <label class="form-label" for="event-description">
                                Beschreibung
                            </label>
                            <textarea
                                id="event-description"
                                name="description"
                                class="form-textarea"
                                placeholder="Zusätzliche Details zum Termin..."
                                maxlength="500"
                                rows="3"
                            >${this.escapeHtml(this.state.eventForm.description)}</textarea>
                            <div class="form-help">Optional - Zusätzliche Informationen zum Termin</div>
                        </div>

                        <!-- Datum und Zeit -->
                        <div class="form-row">
                            <div class="form-group flex-1">
                                <label class="form-label" for="event-date">
                                    Datum *
                                </label>
                                <input
                                    type="date"
                                    id="event-date"
                                    name="event_date"
                                    class="form-input"
                                    value="${this.state.eventForm.event_date}"
                                    required
                                >
                            </div>

                            <div class="form-group flex-1">
                                <label class="form-label" for="event-time">
                                    Uhrzeit
                                </label>
                                <input
                                    type="time"
                                    id="event-time"
                                    name="event_time"
                                    class="form-input"
                                    value="${this.state.eventForm.event_time}"
                                    ${this.state.eventForm.all_day ? 'disabled' : ''}
                                >
                            </div>
                        </div>

                        <!-- Ganztägig -->
                        <div class="form-group">
                            <label class="form-checkbox">
                                <input
                                    type="checkbox"
                                    name="all_day"
                                    ${this.state.eventForm.all_day ? 'checked' : ''}
                                >
                                <span class="checkbox-mark"></span>
                                <span class="checkbox-label">Ganztägiger Termin</span>
                            </label>
                        </div>

                        <!-- Icon Auswahl -->
                        <div class="form-group">
                            <label class="form-label">
                                Icon
                            </label>
                            <div class="icon-selector">
                                ${this.eventIcons.map(icon => `
                                    <button
                                        type="button"
                                        class="icon-option ${this.state.eventForm.icon === icon ? 'selected' : ''}"
                                        data-action="select-icon"
                                        data-icon="${icon}"
                                    >
                                        ${icon}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Kategorie -->
                        <div class="form-group">
                            <label class="form-label" for="event-category">
                                Kategorie
                            </label>
                            <select
                                id="event-category"
                                name="category"
                                class="form-select"
                            >
                                ${this.eventCategories.map(category => `
                                    <option
                                        value="${category.id}"
                                        ${this.state.eventForm.category === category.id ? 'selected' : ''}
                                    >
                                        ${category.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Erinnerung -->
                        <div class="form-group">
                            <label class="form-label" for="event-reminder">
                                Erinnerung
                            </label>
                            <select
                                id="event-reminder"
                                name="reminder_minutes"
                                class="form-select"
                            >
                                <option value="0" ${this.state.eventForm.reminder_minutes === 0 ? 'selected' : ''}>
                                    Keine Erinnerung
                                </option>
                                <option value="15" ${this.state.eventForm.reminder_minutes === 15 ? 'selected' : ''}>
                                    15 Minuten vorher
                                </option>
                                <option value="30" ${this.state.eventForm.reminder_minutes === 30 ? 'selected' : ''}>
                                    30 Minuten vorher
                                </option>
                                <option value="60" ${this.state.eventForm.reminder_minutes === 60 ? 'selected' : ''}>
                                    1 Stunde vorher
                                </option>
                                <option value="1440" ${this.state.eventForm.reminder_minutes === 1440 ? 'selected' : ''}>
                                    1 Tag vorher
                                </option>
                            </select>
                        </div>
                    </form>

                    <div class="dialog-footer">
                        <button type="button" class="btn btn-secondary" data-action="close-dialog">
                            Abbrechen
                        </button>
                        <button 
                            type="submit" 
                            form="event-form"
                            class="btn btn-primary"
                            data-action="save-event"
                            ${this.state.loading ? 'disabled' : ''}
                        >
                            ${this.state.loading ? '💾 Speichere...' : (isEditing ? '✏️ Aktualisieren' : '➕ Erstellen')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderDeleteConfirmDialog() {
        const event = this.state.events.find(e => e.id === this.state.selectedEvent?.id);
        if (!event) return '';

        return `
            <div class="dialog-overlay" data-action="close-delete-confirm">
                <div class="dialog-container delete-confirm-dialog" onclick="event.stopPropagation()">
                    <div class="dialog-header">
                        <h2 class="dialog-title">Termin löschen</h2>
                    </div>

                    <div class="dialog-body">
                        <div class="delete-warning">
                            <div class="warning-icon">⚠️</div>
                            <div class="warning-content">
                                <h3>Termin wirklich löschen?</h3>
                                <p>
                                    <strong>"${this.escapeHtml(event.title)}"</strong><br>
                                    ${this.formatEventDate(new Date(event.event_date))}
                                </p>
                                <p class="warning-text">
                                    Diese Aktion kann nicht rückgängig gemacht werden.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="dialog-footer">
                        <button class="btn btn-secondary" data-action="close-delete-confirm">
                            Abbrechen
                        </button>
                        <button 
                            class="btn btn-error" 
                            data-action="confirm-delete"
                            ${this.state.loading ? 'disabled' : ''}
                        >
                            ${this.state.loading ? '🗑️ Lösche...' : '🗑️ Löschen'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderExportDialog() {
        const userHash = window.app?.state?.userHash;
        const icalUrl = userHash ? `/api/ical/${userHash}` : '#';

        return `
            <div class="dialog-overlay" data-action="close-export-dialog">
                <div class="dialog-container export-dialog" onclick="event.stopPropagation()">
                    <div class="dialog-header">
                        <h2 class="dialog-title">📊 Kalender exportieren</h2>
                        <button class="dialog-close" data-action="close-export-dialog">✕</button>
                    </div>

                    <div class="dialog-body">
                        <div class="export-options">
                            <div class="export-option">
                                <div class="export-icon">📱</div>
                                <div class="export-content">
                                    <h3>iCal / Kalender-App</h3>
                                    <p>Importiere deine Termine in Apple Kalender, Google Calendar, Outlook oder andere Kalender-Apps.</p>
                                    <div class="export-url">
                                        <input 
                                            type="text" 
                                            class="form-input" 
                                            value="${icalUrl}" 
                                            readonly
                                            id="ical-url"
                                        >
                                        <button class="btn btn-secondary btn-sm" data-action="copy-ical-url">
                                            📋 Kopieren
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="export-option">
                                <div class="export-icon">💾</div>
                                <div class="export-content">
                                    <h3>iCal-Datei herunterladen</h3>
                                    <p>Lade eine .ics-Datei herunter um sie in deine Kalender-App zu importieren.</p>
                                    <a 
                                        href="${icalUrl}?download=1" 
                                        class="btn btn-primary"
                                        download="yatwa-calendar.ics"
                                    >
                                        💾 .ics-Datei herunterladen
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div class="export-help">
                            <h4>💡 Anleitung:</h4>
                            <ol>
                                <li><strong>URL kopieren:</strong> Kopiere die iCal-URL oben</li>
                                <li><strong>Kalender-App öffnen:</strong> Öffne deine bevorzugte Kalender-App</li>
                                <li><strong>Kalender hinzufügen:</strong> Suche nach "Kalender abonnieren" oder "URL hinzufügen"</li>
                                <li><strong>URL einfügen:</strong> Füge die kopierte URL ein</li>
                                <li><strong>Fertig!</strong> Deine Termine werden automatisch synchronisiert</li>
                            </ol>
                        </div>
                    </div>

                    <div class="dialog-footer">
                        <button class="btn btn-secondary" data-action="close-export-dialog">
                            Schließen
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderLoadingOverlay() {
        return `
            <div class="loading-overlay">
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p>Lädt...</p>
                </div>
            </div>
        `;
    }

    renderStyles() {
        return `
            <style>
                /* Calendar Container */
                .calendar-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: var(--space-6);
                }

                /* Calendar Header */
                .calendar-header {
                    margin-bottom: var(--space-8);
                }

                .calendar-nav {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-4);
                    flex-wrap: wrap;
                    gap: var(--space-4);
                }

                .date-navigation {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                }

                .current-month {
                    font-size: var(--font-size-2xl);
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                    min-width: 200px;
                    text-align: center;
                }
                
                .current-view-title {
                    font-size: var(--font-size-2xl);
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                    min-width: 200px;
                    text-align: center;
                }

                .calendar-actions {
                    display: flex;
                    gap: var(--space-3);
                    align-items: center;
                }

                .calendar-stats {
                    display: flex;
                    gap: var(--space-6);
                    padding: var(--space-4);
                    background: var(--bg-secondary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }

                .stat-icon {
                    font-size: var(--font-size-base);
                }

                /* Events Display */
                .calendar-view-container {
                    background: var(--bg-primary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                    padding: var(--space-6);
                }

                .events-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: var(--space-4);
                }

                .event-card {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    padding: var(--space-4);
                    transition: all var(--transition);
                    position: relative;
                }

                .event-card:hover {
                    box-shadow: var(--shadow-md);
                    transform: translateY(-2px);
                }

                .event-card.event-today {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 1px var(--primary);
                }

                .event-card.event-past {
                    opacity: 0.7;
                }

                .event-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: var(--space-3);
                }

                .event-icon-category {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }

                .event-icon {
                    font-size: var(--font-size-xl);
                }

                .event-category {
                    font-size: var(--font-size-xs);
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                    font-weight: 500;
                }

                .event-actions {
                    display: flex;
                    gap: var(--space-1);
                    opacity: 0;
                    transition: opacity var(--transition);
                }

                .event-card:hover .event-actions {
                    opacity: 1;
                }

                .btn-icon {
                    background: none;
                    border: none;
                    padding: var(--space-1);
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: background-color var(--transition);
                    font-size: var(--font-size-sm);
                }

                .btn-icon:hover {
                    background: var(--bg-secondary);
                }

                .event-title {
                    font-size: var(--font-size-lg);
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0 0 var(--space-2) 0;
                    line-height: var(--line-height-tight);
                }

                .event-description {
                    color: var(--text-secondary);
                    font-size: var(--font-size-sm);
                    margin: 0 0 var(--space-3) 0;
                    line-height: var(--line-height-normal);
                }

                .event-datetime {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1);
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }

                .event-date,
                .event-time {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                }

                .event-all-day {
                    background: var(--primary);
                    color: white;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-sm);
                    font-size: var(--font-size-xs);
                    font-weight: 500;
                    align-self: flex-start;
                    margin-top: var(--space-1);
                }

                .event-reminder {
                    margin-top: var(--space-2);
                    font-size: var(--font-size-xs);
                    color: var(--text-tertiary);
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                }

                /* Empty State */
                .empty-state {
                    text-align: center;
                    padding: var(--space-12);
                    color: var(--text-secondary);
                }

                .empty-icon {
                    font-size: var(--font-size-5xl);
                    margin-bottom: var(--space-4);
                }

                .empty-state h3 {
                    font-size: var(--font-size-xl);
                    margin-bottom: var(--space-2);
                    color: var(--text-primary);
                }

                .empty-state p {
                    margin-bottom: var(--space-6);
                }

                /* Dialog Styles */
                .dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: var(--z-modal);
                    padding: var(--space-4);
                }

                .dialog-container {
                    background: var(--bg-primary);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-2xl);
                    max-width: 600px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .dialog-header {
                    padding: var(--space-6);
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .dialog-title {
                    font-size: var(--font-size-xl);
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .dialog-close {
                    background: none;
                    border: none;
                    font-size: var(--font-size-xl);
                    color: var(--text-tertiary);
                    cursor: pointer;
                    padding: var(--space-2);
                    border-radius: var(--radius-sm);
                    transition: all var(--transition);
                }

                .dialog-close:hover {
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                }

                .dialog-body {
                    padding: var(--space-6);
                }

                .dialog-footer {
                    padding: var(--space-4) var(--space-6);
                    border-top: 1px solid var(--border-color);
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--space-3);
                }

                /* Form Styles */
                .form-row {
                    display: flex;
                    gap: var(--space-4);
                }

                .form-checkbox {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    cursor: pointer;
                    padding: var(--space-3);
                    border-radius: var(--radius);
                    transition: background-color var(--transition);
                }

                .form-checkbox:hover {
                    background: var(--bg-secondary);
                }

                .form-checkbox input[type="checkbox"] {
                    display: none;
                }

                .checkbox-mark {
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--border-color);
                    border-radius: var(--radius-sm);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all var(--transition);
                }

                .form-checkbox input[type="checkbox"]:checked + .checkbox-mark {
                    background: var(--primary);
                    border-color: var(--primary);
                }

                .form-checkbox input[type="checkbox"]:checked + .checkbox-mark::after {
                    content: '✓';
                    color: white;
                    font-size: var(--font-size-sm);
                    font-weight: bold;
                }

                .checkbox-label {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                /* Icon Selector */
                .icon-selector {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
                    gap: var(--space-2);
                    max-height: 200px;
                    overflow-y: auto;
                    padding: var(--space-2);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius);
                }

                .icon-option {
                    background: none;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius);
                    padding: var(--space-2);
                    font-size: var(--font-size-lg);
                    cursor: pointer;
                    transition: all var(--transition);
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-option:hover {
                    background: var(--bg-secondary);
                    transform: scale(1.05);
                }

                .icon-option.selected {
                    background: var(--primary);
                    border-color: var(--primary);
                    color: white;
                }

                /* Delete Confirmation Dialog */
                .delete-confirm-dialog {
                    max-width: 480px;
                }

                .delete-warning {
                    display: flex;
                    gap: var(--space-4);
                    padding: var(--space-4);
                    background: rgba(239, 68, 68, 0.05);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: var(--radius-lg);
                }

                .warning-icon {
                    font-size: var(--font-size-2xl);
                    color: var(--error);
                    flex-shrink: 0;
                }

                .warning-content h3 {
                    margin: 0 0 var(--space-2) 0;
                    color: var(--text-primary);
                    font-size: var(--font-size-lg);
                }

                .warning-content p {
                    margin: 0 0 var(--space-2) 0;
                    color: var(--text-secondary);
                }

                .warning-text {
                    color: var(--error) !important;
                    font-size: var(--font-size-sm);
                }

                .btn-error {
                    background: var(--error);
                    color: white;
                    border: none;
                }

                .btn-error:hover:not(:disabled) {
                    background: #dc2626;
                    transform: translateY(-1px);
                }

                /* Export Dialog */
                .export-dialog {
                    max-width: 700px;
                }

                .export-options {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6);
                    margin-bottom: var(--space-6);
                }

                .export-option {
                    display: flex;
                    gap: var(--space-4);
                    padding: var(--space-4);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    background: var(--bg-secondary);
                }

                .export-icon {
                    font-size: var(--font-size-2xl);
                    flex-shrink: 0;
                }

                .export-content {
                    flex: 1;
                }

                .export-content h3 {
                    margin: 0 0 var(--space-2) 0;
                    color: var(--text-primary);
                    font-size: var(--font-size-lg);
                }

                .export-content p {
                    margin: 0 0 var(--space-3) 0;
                    color: var(--text-secondary);
                    font-size: var(--font-size-sm);
                }

                .export-url {
                    display: flex;
                    gap: var(--space-2);
                }

                .export-url input {
                    flex: 1;
                    font-family: var(--font-mono);
                    font-size: var(--font-size-sm);
                }

                .export-help {
                    background: var(--bg-tertiary);
                    padding: var(--space-4);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                }

                .export-help h4 {
                    margin: 0 0 var(--space-3) 0;
                    color: var(--text-primary);
                    font-size: var(--font-size-base);
                }

                .export-help ol {
                    margin: 0;
                    padding-left: var(--space-5);
                    color: var(--text-secondary);
                    font-size: var(--font-size-sm);
                    line-height: var(--line-height-relaxed);
                }

                .export-help li {
                    margin-bottom: var(--space-2);
                }

                /* Loading Overlay */
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: calc(var(--z-modal) + 1);
                }

                .loading-content {
                    background: var(--bg-primary);
                    padding: var(--space-6);
                    border-radius: var(--radius-lg);
                    text-align: center;
                    box-shadow: var(--shadow-xl);
                }

                .loading-content .spinner {
                    margin-bottom: var(--space-4);
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .calendar-container {
                        padding: var(--space-4);
                    }

                    .calendar-nav {
                        flex-direction: column;
                        align-items: stretch;
                        gap: var(--space-3);
                    }

                    .date-navigation {
                        justify-content: center;
                    }

                    .current-month {
                        font-size: var(--font-size-xl);
                        min-width: auto;
                    }

                    .calendar-actions {
                        justify-content: center;
                        flex-wrap: wrap;
                    }

                    .calendar-stats {
                        flex-direction: column;
                        gap: var(--space-3);
                    }

                    .events-grid {
                        grid-template-columns: 1fr;
                    }

                    .form-row {
                        flex-direction: column;
                        gap: var(--space-3);
                    }

                    .dialog-container {
                        margin: var(--space-2);
                        max-height: calc(100vh - var(--space-4));
                    }

                    .export-option {
                        flex-direction: column;
                        text-align: center;
                    }

                    .export-url {
                        flex-direction: column;
                    }
                }

                @media (max-width: 480px) {
                    .calendar-container {
                        padding: var(--space-2);
                    }

                    .dialog-header,
                    .dialog-body,
                    .dialog-footer {
                        padding: var(--space-4);
                    }

                    .icon-selector {
                        grid-template-columns: repeat(8, 1fr);
                    }
                }
            </style>
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
                const eventId = e.target.getAttribute('data-event-id');
                this.handleAction(action, eventId);
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

        // Form input changes - WICHTIG: Auch 'change' Event für Selects
        this.querySelectorAll('.form-input, .form-textarea').forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleFormInputChange(e.target.name, e.target.value);
            });
        });

        // Select-Elemente brauchen 'change' statt 'input'
        this.querySelectorAll('.form-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleFormInputChange(e.target.name, e.target.value);
            });
        });

        // Checkbox changes
        this.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleFormInputChange(e.target.name, e.target.checked);
            });
        });

        // Close dialogs on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllDialogs();
            }
        });
    }

    handleAction(action, eventId = null) {
        switch (action) {
            case 'add-event':
                this.showAddEventDialog();
                break;
            case 'edit-event':
                this.showEditEventDialog(eventId);
                break;
            case 'delete-event':
                this.showDeleteConfirmDialog(eventId);
                break;
            case 'save-event':
                this.saveEvent();
                break;
            case 'confirm-delete':
                this.deleteEvent();
                break;
            case 'close-dialog':
                this.closeEventDialog();
                break;
            case 'close-delete-confirm':
                this.closeDeleteConfirmDialog();
                break;
            case 'close-export-dialog':
                this.closeExportDialog();
                break;
            case 'select-icon':
                const icon = event.target.getAttribute('data-icon');
                this.selectIcon(icon);
                break;
            case 'show-past':
                this.setState({ viewFilter: 'past' });
                break;
            case 'show-all':
                this.setState({ viewFilter: 'all' });
                break;
            case 'show-upcoming':
                this.setState({ viewFilter: 'upcoming' });
                break;
            case 'show-today':
                this.setState({ viewFilter: 'today' });
                break;
            case 'export':
                this.showExportDialog();
                break;
            case 'copy-ical-url':
                this.copyICalUrl();
                break;
        }
    }

    async handleFormSubmit(formType, formData) {
        switch (formType) {
            case 'event':
                await this.saveEvent(formData);
                break;
        }
    }

    handleFormInputChange(name, value) {
        this.setState({
            eventForm: {
                ...this.state.eventForm,
                [name]: value
            }
        });

        // Disable time input when all_day is checked
        if (name === 'all_day') {
            const timeInput = this.querySelector('#event-time');
            if (timeInput) {
                timeInput.disabled = value;
                if (value) {
                    timeInput.value = '';
                    this.setState({
                        eventForm: {
                            ...this.state.eventForm,
                            event_time: '',
                            all_day: value
                        }
                    });
                }
            }
        }
    }

    /* ============================================================================
       EVENT DIALOG METHODS
       ============================================================================ */

    showAddEventDialog() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        this.setState({
            showEventDialog: true,
            eventForm: {
                id: null,
                title: '',
                description: '',
                event_date: todayStr,
                event_time: '',
                icon: '📅',
                category: 'general',
                all_day: false,
                reminder_minutes: 0
            }
        });

        // Focus title input after render
        setTimeout(() => {
            const titleInput = this.querySelector('#event-title');
            if (titleInput) titleInput.focus();
        }, 100);
    }

    showEditEventDialog(eventId) {
        const event = this.state.events.find(e => e.id == eventId);
        if (!event) return;

        // Convert event date to YYYY-MM-DD format
        const eventDate = new Date(event.event_date);
        const dateStr = eventDate.toISOString().split('T')[0];

        this.setState({
            showEventDialog: true,
            eventForm: {
                id: event.id,
                title: event.title || '',
                description: event.description || '',
                event_date: dateStr,
                event_time: event.event_time || '',
                icon: event.icon || '📅',
                category: event.category || 'general',
                all_day: event.all_day || false,
                reminder_minutes: event.reminder_minutes || 0
            }
        });

        setTimeout(() => {
            const titleInput = this.querySelector('#event-title');
            if (titleInput) titleInput.focus();
        }, 100);
    }

    closeEventDialog() {
        this.setState({ showEventDialog: false });
    }

    showDeleteConfirmDialog(eventId) {
        const event = this.state.events.find(e => e.id == eventId);
        if (!event) return;

        this.setState({
            showDeleteConfirm: true,
            selectedEvent: event
        });
    }

    closeDeleteConfirmDialog() {
        this.setState({
            showDeleteConfirm: false,
            selectedEvent: null
        });
    }

    showExportDialog() {
        this.setState({ showExportDialog: true });
    }

    closeExportDialog() {
        this.setState({ showExportDialog: false });
    }

    closeAllDialogs() {
        this.setState({
            showEventDialog: false,
            showDeleteConfirm: false,
            showExportDialog: false,
            selectedEvent: null
        });
    }

    selectIcon(icon) {
        this.setState({
            eventForm: {
                ...this.state.eventForm,
                icon
            }
        });
    }

    /* ============================================================================
       EVENT CRUD OPERATIONS
       ============================================================================ */

    async saveEvent(formData = null) {
        this.setState({ loading: true });

        try {
            let eventData;

            if (formData) {
                // Aus FormData konvertieren
                eventData = Object.fromEntries(formData.entries());
                // Checkbox-Werte richtig behandeln
                eventData.all_day = formData.has('all_day'); // Checkbox ist nur in FormData wenn checked
            } else {
                // Aus state nehmen
                eventData = this.state.eventForm;
            }

            // Validation
            if (!eventData.title?.trim()) {
                throw new Error('Titel ist erforderlich');
            }

            if (!eventData.event_date) {
                throw new Error('Datum ist erforderlich');
            }

            // Prepare data for API
            const apiEventData = {
                title: eventData.title.trim(),
                description: eventData.description?.trim() || null,
                event_date: eventData.event_date,
                event_time: eventData.all_day ? null : (eventData.event_time || null),
                icon: eventData.icon || '📅',
                category: eventData.category || 'general',
                all_day: Boolean(eventData.all_day),
                reminder_minutes: parseInt(eventData.reminder_minutes) || 0
            };

            console.log('Saving event data:', apiEventData); // Debug-Log

            let savedEvent;
            if (this.state.eventForm.id) {
                // Update existing event
                savedEvent = await window.app.updateEvent(this.state.eventForm.id, apiEventData);
            } else {
                // Create new event
                savedEvent = await window.app.createEvent(apiEventData);
            }

            // Update local state
            if (this.state.eventForm.id) {
                this.setState({
                    events: this.state.events.map(event =>
                        event.id === this.state.eventForm.id ? savedEvent : event
                    )
                });
            } else {
                this.setState({
                    events: [...this.state.events, savedEvent]
                });
            }

            this.setState({
                loading: false,
                showEventDialog: false
            });

        } catch (error) {
            console.error('Failed to save event:', error);
            this.setState({
                loading: false,
                error: error.message
            });
            this.showToast(error.message, 'error');
        }
    }

    async deleteEvent() {
        if (!this.state.selectedEvent) return;

        this.setState({ loading: true });

        try {
            await window.app.deleteEvent(this.state.selectedEvent.id);

            this.setState({
                events: this.state.events.filter(event =>
                    event.id !== this.state.selectedEvent.id
                ),
                loading: false,
                showDeleteConfirm: false,
                selectedEvent: null
            });

        } catch (error) {
            console.error('Failed to delete event:', error);
            this.setState({
                loading: false,
                error: error.message
            });
            this.showToast(error.message, 'error');
        }
    }

    /* ============================================================================
       NAVIGATION METHODS
       ============================================================================ */

    navigateMonth(direction) {
        const newDate = new Date(this.state.currentDate);
        newDate.setMonth(newDate.getMonth() + direction);
        this.setState({ currentDate: newDate });
    }

    goToToday() {
        this.setState({ currentDate: new Date() });
    }

    /* ============================================================================
       EXPORT METHODS
       ============================================================================ */

    async copyICalUrl() {
        const userHash = window.app?.state?.userHash;
        if (!userHash) return;

        const url = `${window.location.origin}/api/ical/${userHash}`;

        try {
            await navigator.clipboard.writeText(url);
            this.showToast('iCal-URL kopiert! 📋', 'success');

            // Visual feedback
            const button = this.querySelector('[data-action="copy-ical-url"]');
            if (button) {
                const originalText = button.textContent;
                button.textContent = '✅ Kopiert!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }

        } catch (error) {
            console.error('Failed to copy URL:', error);
            this.showToast('Kopieren fehlgeschlagen', 'error');
        }
    }

    /* ============================================================================
       UTILITY METHODS
       ============================================================================ */

    formatMonthYear(date) {
        return date.toLocaleDateString('de-DE', {
            month: 'long',
            year: 'numeric'
        });
    }

    formatEventDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (this.isSameDay(date, today)) {
            return 'Heute';
        } else if (this.isSameDay(date, tomorrow)) {
            return 'Morgen';
        } else {
            return date.toLocaleDateString('de-DE', {
                day: 'numeric',
                month: 'long',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
        }
    }

    isToday(date) {
        return this.isSameDay(date, new Date());
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getFullYear() === date2.getFullYear();
    }

    getSortedUpcomingEvents() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return this.state.events
            .filter(event => {
                const eventDate = new Date(event.event_date);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= now;
            })
            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    }

    getUpcomingEventsCount() {
        return this.getSortedUpcomingEvents().length;
    }

    getViewTitle() {
        switch (this.state.viewFilter) {
            case 'past':
                return 'Vergangene Termine';
            case 'all':
                return 'Alle Termine';
            case 'today':
                return 'Heutige Termine';
            case 'upcoming':
            default:
                return 'Bevorstehende Termine';
        }
    }

    getFilteredEventsForView() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        switch (this.state.viewFilter) {
            case 'past':
                return this.state.events
                    .filter(event => {
                        const eventDate = new Date(event.event_date);
                        eventDate.setHours(0, 0, 0, 0);
                        return eventDate < now;
                    })
                    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date)); // Neueste zuerst

            case 'today': // ← NEU
                return this.state.events
                    .filter(event => {
                        const eventDate = new Date(event.event_date);
                        return this.isSameDay(eventDate, now);
                    })
                    .sort((a, b) => {
                        // bei gleichen Tagen nach Uhrzeit sortieren
                        if (a.event_time && b.event_time) {
                            return a.event_time.localeCompare(b.event_time);
                        }
                        return 0;
                    });

            case 'all':
                return this.state.events
                    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

            case 'upcoming':
            default:
                return this.getSortedUpcomingEvents();
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }

    cleanup() {
        // Remove any event listeners if needed
        document.removeEventListener('keydown', this.handleEscapeKey);
    }
}

// Register the component
customElements.define('calendar-component', CalendarComponent);