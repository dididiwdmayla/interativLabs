import { expect, it } from "vitest";
import { measureRoda } from "../../scripts/measure-roda";
it("Roda e lingueta: held, released, one crank turn, eight teeth and layer isolation", async () => {
  const report = await measureRoda();
  expect(report.fixture.pass, JSON.stringify(report.fixture.runs)).toBe(true);
  for (const run of report.fixture.runs) expect(run.maxDepth).toBeLessThan(0.3);
  expect(report.runs[0]!.finalWheelDeg).toBeGreaterThanOrEqual(30);
  expect(report.runs[1]!.maxReverseDeg).toBeLessThanOrEqual(17);
  expect(report.runs[1]!.stationarySpanDeg).toBeLessThan(1);
  const drive = report.runs[2]!;
  expect(drive.angleAtDriveEnd).toBeGreaterThanOrEqual(-126);
  expect(drive.angleAtDriveEnd).toBeLessThanOrEqual(-114);
  expect(drive.wheelTravelDeg).toBeGreaterThanOrEqual(-126);
  expect(drive.wheelTravelDeg).toBeLessThanOrEqual(-114);
  expect(drive.pinionTravelDeg).toBeGreaterThan(355);
  expect(drive.pinionTravelDeg).toBeLessThan(365);
  expect(drive.clicks).toBeGreaterThanOrEqual(7);
  expect(drive.clicks).toBeLessThanOrEqual(9);
  for (const run of report.runs) {
    expect(run.contactSamples).toBeGreaterThan(0);
    expect(run.mismatchedContacts).toBe(0);
  }
}, 30000);
