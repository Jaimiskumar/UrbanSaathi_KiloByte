import test from 'node:test';
import assert from 'node:assert/strict';
import { getGreenAiStatus } from '../services/greenAiStatusService.js';

test('Green AI status reports real process, dataset and artifact availability without local paths', () => {
  const originalDatasetRoot = process.env.URBANSAATHI_DATASET_ROOT;
  process.env.URBANSAATHI_DATASET_ROOT = 'C:\\does-not-exist\\urbansaathi-datasets';

  try {
    const status = getGreenAiStatus(1);
    const serialized = JSON.stringify(status);

    assert.equal(status.database.connected, true);
    assert.equal(status.datasets.rootAvailable, false);
    assert.equal(status.datasets.availableCount, 0);
    assert.equal(status.runtime.cpuCores > 0, true);
    assert.ok(status.runtime.hostMemoryBytes > 0);
    assert.ok(status.trainingMetrics.models);
    assert.equal(serialized.includes('C:\\does-not-exist'), false);
    assert.equal(typeof status.benchmark.available, 'boolean');
  } finally {
    if (originalDatasetRoot === undefined) delete process.env.URBANSAATHI_DATASET_ROOT;
    else process.env.URBANSAATHI_DATASET_ROOT = originalDatasetRoot;
  }
});
