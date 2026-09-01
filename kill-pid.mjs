const pid = parseInt(process.argv[2], 10);
try { process.kill(pid); console.log('killed', pid); } catch(e) { console.log('err', e.message); }
