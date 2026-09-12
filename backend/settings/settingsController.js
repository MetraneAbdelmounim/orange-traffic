const Settings = require('./settings');
const asyncHandler = require('../middlewares/asyncHandler');

const WRITABLE = ['pollIntervalSeconds', 'defaultSnmpCommunity'];

function pick(body) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(([k]) => WRITABLE.includes(k))
  );
}

module.exports = {
  getSettings: asyncHandler(async (_req, res) => {
    const settings = await Settings.load();
    return res.status(200).json(settings);
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const settings = await Settings.findByIdAndUpdate(
      'singleton',
      { $set: pick(req.body) },
      { new: true, upsert: true, runValidators: true }
    );
    return res.status(200).json(settings);
  }),
};
