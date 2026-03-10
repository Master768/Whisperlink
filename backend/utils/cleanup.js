const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const FILE_EXPIRATION_TIME = 60 * 60 * 1000; // 1 hour in ms

const cleanupFiles = () => {
    console.log('Running background file cleanup sweep...');

    fs.readdir(UPLOADS_DIR, (err, files) => {
        if (err) {
            console.error('Error reading uploads directory during cleanup:', err);
            return;
        }

        const now = Date.now();

        files.forEach(file => {
            const filePath = path.join(UPLOADS_DIR, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Error stat-ing file ${file}:`, err);
                    return;
                }

                const age = now - stats.mtimeMs;
                if (age > FILE_EXPIRATION_TIME) {
                    fs.unlink(filePath, err => {
                        if (err) {
                            console.error(`Error deleting expired file ${file}:`, err);
                        } else {
                            console.log(`Deleted expired file: ${file}`);
                        }
                    });
                }
            });
        });
    });
};

// Run every 15 minutes as per requirements
const startCleanupJob = () => {
    cron.schedule('*/15 * * * *', cleanupFiles);
    console.log('File cleanup job scheduled (every 15 mins)');
};

module.exports = { startCleanupJob, cleanupFiles };
