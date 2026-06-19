import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  const pipe = new MarkdownPipe();

  it('returns an empty string for nullish or blank input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('   ')).toBe('');
  });

  it('renders inline emphasis and strong text', () => {
    const html = pipe.transform('This is **bold** and *italic*.');

    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders headings and unordered lists', () => {
    const html = pipe.transform('# Title\n\n- one\n- two');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
  });

  it('renders links', () => {
    const html = pipe.transform('[example](https://example.com)');

    expect(html).toContain('<a href="https://example.com">example</a>');
  });

  it('converts single line breaks into <br> via the breaks option', () => {
    const html = pipe.transform('line one\nline two');

    expect(html).toContain('<br>');
  });

  it('returns a string synchronously rather than a promise', () => {
    expect(typeof pipe.transform('plain text')).toBe('string');
  });
});
