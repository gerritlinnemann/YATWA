-- 🗄️ YATWA Database Schema
-- MariaDB initialization script

USE yatwa;

-- 👤 Users Table
-- Stores user hashes for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hash VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📅 Events Table  
-- Stores calendar events with labels and icons
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_hash VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NULL,
    icon VARCHAR(50) DEFAULT 'calendar',
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key to users table
    FOREIGN KEY (user_hash) REFERENCES users(hash) ON DELETE CASCADE,
    
    -- Index for faster queries
    INDEX idx_user_hash (user_hash),
    INDEX idx_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📊 Create some sample data for development
-- (Only if tables are empty)
INSERT INTO users (hash) 
SELECT 'demo-hash-12345' 
WHERE NOT EXISTS (SELECT 1 FROM users WHERE hash = 'demo-hash-12345');

INSERT INTO events (user_hash, title, event_date, event_time, icon, description)
SELECT 
    'demo-hash-12345',
    'Demo Termin',
    DATE_ADD(CURDATE(), INTERVAL 7 DAY),
    '14:00:00',
    'meeting',
    'Ein Beispiel-Termin für die Entwicklung'
WHERE NOT EXISTS (
    SELECT 1 FROM events 
    WHERE user_hash = 'demo-hash-12345' 
    AND title = 'Demo Termin'
);

-- 🔍 Useful views for development
CREATE OR REPLACE VIEW user_events AS
SELECT 
    u.hash as user_hash,
    u.created_at as user_created,
    u.last_accessed,
    e.id as event_id,
    e.title,
    e.event_date,
    e.event_time,
    e.icon,
    e.description,
    e.created_at as event_created,
    e.updated_at as event_updated
FROM users u
LEFT JOIN events e ON u.hash = e.user_hash
ORDER BY u.created_at DESC, e.event_date ASC;

-- 📈 Performance optimizations
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_hash, event_date);
CREATE INDEX IF NOT EXISTS idx_users_last_accessed ON users(last_accessed);

-- 🧹 Cleanup procedures (for future use)
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS cleanup_old_users()
BEGIN
    -- Delete users that haven't been accessed for 1 year
    DELETE FROM users 
    WHERE last_accessed < DATE_SUB(NOW(), INTERVAL 1 YEAR);
END //

CREATE PROCEDURE IF NOT EXISTS get_user_stats()
BEGIN
    SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN last_accessed > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_users_30d,
        (SELECT COUNT(*) FROM events) as total_events
    FROM users;
END //

DELIMITER ;

-- 🎯 Success message
SELECT 'YATWA Database initialized successfully!' as status;
