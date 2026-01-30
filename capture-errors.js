// 🔍 AUTO ERROR CAPTURE SCRIPT
// Add this to your chat.html TEMPORARILY to capture all console errors

(function () {
    const errors = [];
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = function (...args) {
        errors.push({ type: 'ERROR', time: new Date().toISOString(), message: args.join(' ') });
        originalError.apply(console, args);
    };

    console.warn = function (...args) {
        errors.push({ type: 'WARN', time: new Date().toISOString(), message: args.join(' ') });
        originalWarn.apply(console, args);
    };

    window.addEventListener('error', function (e) {
        errors.push({
            type: 'UNCAUGHT ERROR',
            time: new Date().toISOString(),
            message: e.message,
            file: e.filename,
            line: e.lineno,
            col: e.colno
        });
    });

    // Export errors after 10 seconds
    setTimeout(() => {
        console.log('====== CAPTURED ERRORS ======');
        console.log(JSON.stringify(errors, null, 2));
        console.log(`Total errors captured: ${errors.length}`);

        // Group by type
        const grouped = errors.reduce((acc, err) => {
            acc[err.type] = (acc[err.type] || 0) + 1;
            return acc;
        }, {});
        console.log('Errors by type:', grouped);

        // Show most common error
        const messages = {};
        errors.forEach(err => {
            const msg = err.message.substring(0, 100);
            messages[msg] = (messages[msg] || 0) + 1;
        });
        const sorted = Object.entries(messages).sort((a, b) => b[1] - a[1]);
        console.log('\nTop 5 most common errors:');
        sorted.slice(0, 5).forEach(([msg, count]) => {
            console.log(`${count}x: ${msg}`);
        });
    }, 10000);

    console.log('✅ Error capture script loaded. Will report in 10 seconds...');
})();
