export function sma(values: number[], length: number): (number | null)[] {
  if (!Number.isInteger(length) || length < 1) throw new RangeError('SMA length must be positive.');
  let sum = 0;
  return values.map((value, index) => {
    sum += value;
    if (index >= length) sum -= values[index - length];
    return index + 1 >= length ? sum / length : null;
  });
}

export function ema(values: number[], length: number): (number | null)[] {
  if (!Number.isInteger(length) || length < 1) throw new RangeError('EMA length must be positive.');
  const result: (number | null)[] = [];
  const alpha = 2 / (length + 1);
  let sum = 0;
  let previous = 0;
  values.forEach((value, index) => {
    if (index < length) sum += value;
    if (index < length - 1) result.push(null);
    else if (index === length - 1) {
      previous = sum / length;
      result.push(previous);
    } else {
      previous = value * alpha + previous * (1 - alpha);
      result.push(previous);
    }
  });
  return result;
}

export function macd(values: number[], fast = 12, slow = 26, signalLength = 9) {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);
  const line = values.map((_, index) => fastLine[index] !== null && slowLine[index] !== null ? fastLine[index]! - slowLine[index]! : null);
  const first = line.findIndex(value => value !== null);
  const signal: (number | null)[] = Array(values.length).fill(null);
  if (first >= 0) ema(line.slice(first) as number[], signalLength).forEach((value, index) => { signal[first + index] = value; });
  const histogram = line.map((value, index) => value !== null && signal[index] !== null ? value - signal[index]! : null);
  return { line, signal, histogram };
}

export function rsi(values: number[], length = 14): (number | null)[] {
  if (!Number.isInteger(length) || length < 1) throw new RangeError('RSI length must be positive.');
  const result: (number | null)[] = values.map(() => null);
  if (values.length <= length) return result;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= length; index++) {
    const change = values[index] - values[index - 1];
    gains += Math.max(0, change);
    losses += Math.max(0, -change);
  }
  gains /= length;
  losses /= length;
  const value = () => gains === 0 && losses === 0 ? 50 : losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
  result[length] = value();
  for (let index = length + 1; index < values.length; index++) {
    const change = values[index] - values[index - 1];
    gains = (gains * (length - 1) + Math.max(0, change)) / length;
    losses = (losses * (length - 1) + Math.max(0, -change)) / length;
    result[index] = value();
  }
  return result;
}
