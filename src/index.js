const { runPipeline } = require('./pipeline');
const { sendErrorAlert } = require('./errorAlert');

runPipeline().catch(async (err) => {
  await sendErrorAlert(err, 'one-off run (npm start)');
  process.exit(1);
});
