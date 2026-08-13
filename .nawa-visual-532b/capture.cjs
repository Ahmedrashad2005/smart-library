const fs = require('node:fs');
const WebSocket = require('ws');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const targets = await fetch('http://127.0.0.1:9224/json').then((response) => response.json());
  const page = targets.find((target) => target.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  let id = 0;
  const pending = new Map();
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (!message.id || !pending.has(message.id)) return;
    const handlers = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      pending.set(callId, { resolve, reject });
      socket.send(JSON.stringify({ id: callId, method, params }));
    });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await wait(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const clickText = async (text, selector = 'button') => {
    const clicked = await evaluate(`(() => {
      const target = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(
        (element) => element.textContent.trim() === ${JSON.stringify(text)},
      );
      target?.click();
      return Boolean(target);
    })()`);
    if (!clicked) throw new Error(`Control not found: ${text}`);
  };
  const capture = async (name, width, height) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(`window.scrollTo({ top: 0, left: 0, behavior: 'instant' })`);
    await wait(250);
    const overflow = await evaluate(
      `Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth`,
    );
    if (overflow > 1) throw new Error(`${name} has ${overflow}px horizontal overflow`);
    const result = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    fs.writeFileSync(
      `/home/ahmed/smart library/.nawa-visual-532b/${name}.png`,
      result.data,
      'base64',
    );
    console.log(`${name}: no horizontal overflow`);
  };

  await waitFor(`document.querySelector('.member-login-card')`);
  await evaluate(`document.querySelectorAll('.member-login-card input')[0].focus()`);
  await send('Input.insertText', { text: 'member5@smart-library.test' });
  await evaluate(`document.querySelectorAll('.member-login-card input')[1].focus()`);
  await send('Input.insertText', { text: 'SmartLib123' });
  await evaluate(`document.querySelector('.member-login-card form button').click()`);
  await waitFor(
    `location.pathname === '/my-reservations' && document.querySelectorAll('.member-reservation-card').length === 2`,
  );
  if ((await evaluate(`document.documentElement.dir`)) !== 'rtl') await clickText('العربية');
  await waitFor(`document.documentElement.dir === 'rtl'`);

  await capture('ar-active-1440', 1440, 1500);
  await capture('ar-active-900', 900, 1400);
  await capture('ar-active-390', 390, 1800);

  await capture('ar-dialog-base-900', 900, 1000);
  await clickText('إلغاء الحجز');
  await waitFor(`document.querySelector('[role="dialog"]')`);
  await capture('ar-cancel-dialog-900', 900, 1000);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitFor(`!document.querySelector('[role="dialog"]')`);

  await clickText('عرض التفاصيل');
  await waitFor(`document.querySelector('.member-reservation-detail')`);
  await capture('ar-detail-390', 390, 1500);
  await evaluate(`document.querySelector('.member-back-button').click()`);
  await waitFor(`document.querySelectorAll('.member-reservation-card').length === 2`);
  await clickText('الملغاة');
  await waitFor(`document.querySelector('.member-reservation-status.is-cancelled')`);
  await capture('ar-cancelled-900', 900, 1100);
  await clickText('المنتهية');
  await waitFor(`document.querySelector('.member-reservation-status.is-expired')`);
  await capture('ar-expired-390', 390, 1100);

  await clickText('English');
  await waitFor(`document.documentElement.dir === 'ltr'`);
  await clickText('Active');
  await waitFor(`document.querySelectorAll('.member-reservation-card').length === 2`);
  await capture('en-active-1440', 1440, 1500);
  await capture('en-active-900', 900, 1400);
  await capture('en-active-390', 390, 1800);

  await clickText('Cancel reservation');
  await waitFor(`document.querySelector('[role="dialog"]')`);
  await capture('en-cancel-dialog-390', 390, 900);
  await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    buttons.find((button) => button.textContent.trim() === 'Cancel reservation')?.click();
  })()`);
  await waitFor(
    `!document.querySelector('[role="dialog"]') && document.body.textContent.includes('Reservation cancelled')`,
  );
  await capture('en-cancel-success-390', 390, 1400);

  await clickText('Cancel reservation');
  await waitFor(`document.querySelector('[role="dialog"]')`);
  await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    buttons.find((button) => button.textContent.trim() === 'Cancel reservation')?.click();
  })()`);
  await waitFor(`document.body.textContent.includes('No active reservations')`);
  await capture('en-empty-active-390', 390, 1000);
  await clickText('Cancelled');
  await waitFor(`document.querySelectorAll('.member-reservation-status.is-cancelled').length === 3`);
  await capture('en-cancelled-900', 900, 1500);

  socket.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  setTimeout(() => process.exit(), 20);
});
