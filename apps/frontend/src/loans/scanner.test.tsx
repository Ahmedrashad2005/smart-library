import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanButton } from './pages';

type Detection = { rawValue?: string };

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const stream = () => {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return {
    mediaStream: { getTracks: () => tracks } as unknown as MediaStream,
    tracks,
  };
};

function Harness({
  onValue = vi.fn(),
  onError = vi.fn(),
}: {
  onValue?: (value: string) => void;
  onError?: (message: string) => void;
}) {
  const [error, setError] = useState('');
  return (
    <div>
      <label>
        Manual code
        <input />
      </label>
      <ScanButton
        onValue={onValue}
        onError={(message) => {
          setError(message);
          onError(message);
        }}
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

describe('ScanButton camera lifecycle', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let detect: ReturnType<typeof vi.fn>;

  const installDetector = () => {
    class BarcodeDetector {
      detect(source: HTMLVideoElement): Promise<Detection[]> {
        return detect(source) as Promise<Detection[]>;
      }
    }
    Object.defineProperty(window, 'BarcodeDetector', {
      configurable: true,
      value: BarcodeDetector,
    });
  };

  const installCamera = () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
  };

  beforeEach(() => {
    getUserMedia = vi.fn();
    detect = vi.fn();
    installCamera();
    installDetector();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  });

  it('requests the camera only after the accessible Scan button is activated', async () => {
    const camera = deferred<MediaStream>();
    getUserMedia.mockReturnValue(camera.promise);
    const user = userEvent.setup();
    render(<Harness />);

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Manual code')).toBeInTheDocument();
    const scan = screen.getByRole('button', { name: 'Scan QR / barcode' });
    scan.focus();
    await user.keyboard('{Enter}');

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Scan QR or barcode' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Starting camera');
    expect(screen.getByRole('button', { name: 'Close scanner' })).toBeInTheDocument();
  });

  it('shows a visible scanning state and delivers one exact trimmed result', async () => {
    const activeStream = stream();
    getUserMedia.mockResolvedValue(activeStream.mediaStream);
    const detection = deferred<Detection[]>();
    detect.mockReturnValue(detection.promise);
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));
    expect(await screen.findByText('Scanning for a code…')).toBeInTheDocument();
    detection.resolve([{ rawValue: '  COPY-QR-1  ' }, { rawValue: 'DUPLICATE' }]);

    await waitFor(() => expect(onValue).toHaveBeenCalledOnce());
    expect(onValue).toHaveBeenCalledWith('COPY-QR-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    activeStream.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce());
  });

  it('reports permission denial without removing manual entry', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<Harness onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Camera permission was denied');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('permission was denied'));
    expect(screen.getByLabelText('Manual code')).toBeInTheDocument();
  });

  it.each(['mediaDevices', 'getUserMedia'] as const)(
    'handles missing navigator.%s and preserves manual entry',
    async (missing) => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: missing === 'mediaDevices' ? undefined : {},
      });
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('not supported');
      expect(screen.getByLabelText('Manual code')).toBeInTheDocument();
      expect(getUserMedia).not.toHaveBeenCalled();
    },
  );

  it('handles an unsupported BarcodeDetector without requesting a stream', async () => {
    Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: undefined });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Barcode scanning is not supported');
    expect(screen.getByLabelText('Manual code')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('reports an empty detection and stops every active track', async () => {
    const activeStream = stream();
    getUserMedia.mockResolvedValue(activeStream.mediaStream);
    detect.mockResolvedValue([{ rawValue: '   ' }]);
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No valid QR or barcode');
    expect(onValue).not.toHaveBeenCalled();
    activeStream.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce());
  });

  it('reports a detector failure and does not leave camera resources active', async () => {
    const activeStream = stream();
    getUserMedia.mockResolvedValue(activeStream.mediaStream);
    detect.mockRejectedValue(new Error('Detector failed'));
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('camera could not scan');
    expect(screen.getByLabelText('Manual code')).toBeInTheDocument();
    activeStream.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce());
  });

  it('stops all tracks when closed with the keyboard and creates a fresh reopened session', async () => {
    const first = stream();
    const second = stream();
    getUserMedia.mockResolvedValueOnce(first.mediaStream).mockResolvedValueOnce(second.mediaStream);
    detect.mockImplementation(() => new Promise<Detection[]>(() => undefined));
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));
    await screen.findByText('Scanning for a code…');
    const close = screen.getByRole('button', { name: 'Close scanner' });
    close.focus();
    await user.keyboard('{Enter}');
    first.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce());

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    await screen.findByText('Scanning for a code…');
    await user.keyboard('{Escape}');
    second.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce());
  });

  it('stops active tracks on unmount and ignores an old detector callback', async () => {
    const activeStream = stream();
    const detection = deferred<Detection[]>();
    getUserMedia.mockResolvedValue(activeStream.mediaStream);
    detect.mockReturnValue(detection.promise);
    const onValue = vi.fn();
    const user = userEvent.setup();
    const view = render(<Harness onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));
    await screen.findByText('Scanning for a code…');
    view.unmount();
    activeStream.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce());
    detection.resolve([{ rawValue: 'STALE-CODE' }]);
    await Promise.resolve();
    expect(onValue).not.toHaveBeenCalled();
  });

  it('ignores a detector callback that resolves after the scanner is closed', async () => {
    const activeStream = stream();
    const detection = deferred<Detection[]>();
    getUserMedia.mockResolvedValue(activeStream.mediaStream);
    detect.mockReturnValue(detection.promise);
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));
    await screen.findByText('Scanning for a code…');
    await user.click(screen.getByRole('button', { name: 'Close scanner' }));
    detection.resolve([{ rawValue: 'STALE-AFTER-CLOSE' }]);
    await Promise.resolve();

    expect(onValue).not.toHaveBeenCalled();
    activeStream.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce());
  });

  it('prevents repeated Scan clicks and safely closes pending camera startup', async () => {
    const camera = deferred<MediaStream>();
    const lateStream = stream();
    getUserMedia.mockReturnValue(camera.promise);
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    const scan = screen.getByRole('button', { name: 'Scan QR / barcode' });
    await user.click(scan);
    expect(scan).toBeDisabled();
    await user.click(scan);
    expect(getUserMedia).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Close scanner' }));
    camera.resolve(lateStream.mediaStream);

    await waitFor(() =>
      lateStream.tracks.forEach(({ stop }) => expect(stop).toHaveBeenCalledOnce()),
    );
    expect(detect).not.toHaveBeenCalled();
    expect(onValue).not.toHaveBeenCalled();
  });

  it('surfaces a backend lookup rejection after one scan and keeps manual fallback available', async () => {
    const activeStream = stream();
    getUserMedia.mockResolvedValue(activeStream.mediaStream);
    detect.mockResolvedValue([{ rawValue: 'COPY-LOOKUP' }]);
    const lookup = vi.fn().mockRejectedValue(new Error('Copy was not found'));
    const user = userEvent.setup();

    function LookupHarness() {
      const [error, setError] = useState('');
      return (
        <div>
          <label>
            Manual code
            <input />
          </label>
          <ScanButton
            onValue={(value) =>
              void lookup(value).catch((reason: Error) => setError(reason.message))
            }
            onError={setError}
          />
          {error && <p role="alert">{error}</p>}
        </div>
      );
    }

    render(<LookupHarness />);
    await user.click(screen.getByRole('button', { name: 'Scan QR / barcode' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Copy was not found');
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith('COPY-LOOKUP');
    expect(screen.getByLabelText('Manual code')).toBeInTheDocument();
  });
});
