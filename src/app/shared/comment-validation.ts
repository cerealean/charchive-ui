import { AbstractControl, ValidationErrors } from '@angular/forms';

export const MAX_COMMENT_LENGTH = 1000;

export type CommentRejectionReason = 'empty' | 'too_long' | 'html' | 'url';

export type CommentValidationResult =
  | { valid: true; value: string }
  | { valid: false; reason: CommentRejectionReason; message: string };

// Common website TLDs used to detect bare domains such as "example.com".
// This list MUST stay in sync with the validate_card_comment() database trigger
// (supabase migration ..._add_card_comments.sql) so client and server agree.
const URL_TLDS = [
  'com', 'net', 'org', 'io', 'co', 'dev', 'app', 'ai', 'gg', 'xyz', 'info', 'biz',
  'me', 'tv', 'news', 'blog', 'site', 'online', 'shop', 'store', 'link', 'click',
  'live', 'fun', 'top', 'ru', 'cn', 'uk', 'de', 'fr', 'jp', 'br', 'in', 'ca',
  'au', 'us', 'eu', 'nl', 'es', 'it', 'kr', 'mx', 'gov', 'edu',
];

const HTML_PATTERN = /[<>]/;
const SCHEME_URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\//i;
const DANGEROUS_SCHEME_PATTERN = /\b(?:javascript|data|vbscript)\s*:/i;
const WWW_PATTERN = /\bwww\./i;
const BARE_DOMAIN_PATTERN = new RegExp(
  `\\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.(?:${URL_TLDS.join('|')})\\b`,
  'i',
);

const HTML_MESSAGE = 'Comments must be plain text and cannot contain HTML, markup, or scripts.';
const URL_MESSAGE = 'Comments cannot contain links or website addresses.';
const TOO_LONG_MESSAGE = `Comments must be ${MAX_COMMENT_LENGTH} characters or fewer.`;
const EMPTY_MESSAGE = 'Enter a comment before posting.';

export function containsHtml(value: string): boolean {
  return HTML_PATTERN.test(value);
}

export function containsUrl(value: string): boolean {
  return (
    SCHEME_URL_PATTERN.test(value) ||
    DANGEROUS_SCHEME_PATTERN.test(value) ||
    WWW_PATTERN.test(value) ||
    BARE_DOMAIN_PATTERN.test(value)
  );
}

export function validateCommentContent(rawValue: string): CommentValidationResult {
  const value = (rawValue ?? '').trim();

  if (value.length === 0) {
    return { valid: false, reason: 'empty', message: EMPTY_MESSAGE };
  }

  if (value.length > MAX_COMMENT_LENGTH) {
    return { valid: false, reason: 'too_long', message: TOO_LONG_MESSAGE };
  }

  if (containsHtml(value)) {
    return { valid: false, reason: 'html', message: HTML_MESSAGE };
  }

  if (containsUrl(value)) {
    return { valid: false, reason: 'url', message: URL_MESSAGE };
  }

  return { valid: true, value };
}

// Reactive-forms validator. Leaves the "empty" case to Validators.required so the
// control only reports a content problem (length/html/url) once text is entered.
export function commentContentValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').trim();

  if (value.length === 0) {
    return null;
  }

  const result = validateCommentContent(value);
  return result.valid ? null : { commentContent: { reason: result.reason, message: result.message } };
}
