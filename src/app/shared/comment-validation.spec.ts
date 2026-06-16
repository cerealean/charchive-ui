import { FormControl } from '@angular/forms';

import {
  MAX_COMMENT_LENGTH,
  commentContentValidator,
  validateCommentContent,
} from './comment-validation';

describe('comment-validation', () => {
  it('accepts ordinary plain-text comments', () => {
    const result = validateCommentContent('  Such a great character, love the writing!  ');

    expect(result).toEqual({ valid: true, value: 'Such a great character, love the writing!' });
  });

  it('rejects an empty or whitespace-only comment', () => {
    expect(validateCommentContent('   ')).toMatchObject({ valid: false, reason: 'empty' });
  });

  it('rejects comments longer than the maximum length', () => {
    const tooLong = 'a'.repeat(MAX_COMMENT_LENGTH + 1);

    expect(validateCommentContent(tooLong)).toMatchObject({ valid: false, reason: 'too_long' });
  });

  it('accepts a comment exactly at the maximum length', () => {
    const exact = 'a'.repeat(MAX_COMMENT_LENGTH);

    expect(validateCommentContent(exact)).toMatchObject({ valid: true });
  });

  it('rejects HTML tags and angle brackets', () => {
    expect(validateCommentContent('<b>hi</b>')).toMatchObject({ valid: false, reason: 'html' });
    expect(validateCommentContent('<script>alert(1)</script>')).toMatchObject({
      valid: false,
      reason: 'html',
    });
    expect(validateCommentContent('3 > 2 is true')).toMatchObject({ valid: false, reason: 'html' });
  });

  it('rejects scheme-based URLs', () => {
    expect(validateCommentContent('see https://example.com/page')).toMatchObject({
      valid: false,
      reason: 'url',
    });
    expect(validateCommentContent('ftp://files.example')).toMatchObject({
      valid: false,
      reason: 'url',
    });
  });

  it('rejects dangerous schemes even without slashes', () => {
    expect(validateCommentContent('javascript:alert(1)')).toMatchObject({
      valid: false,
      reason: 'url',
    });
  });

  it('rejects www-prefixed and bare domain links', () => {
    expect(validateCommentContent('go to www.evil.test now')).toMatchObject({
      valid: false,
      reason: 'url',
    });
    expect(validateCommentContent('check out evil.com for more')).toMatchObject({
      valid: false,
      reason: 'url',
    });
    expect(validateCommentContent('grab it at sketchy.io/free')).toMatchObject({
      valid: false,
      reason: 'url',
    });
  });

  it('does not flag ordinary prose that merely abbreviates words', () => {
    expect(validateCommentContent('I really like this, e.g. the personality')).toMatchObject({
      valid: true,
    });
    expect(validateCommentContent('Great work overall. Thanks!')).toMatchObject({ valid: true });
  });

  it('validator passes for empty controls and leaves required to handle it', () => {
    expect(commentContentValidator(new FormControl(''))).toBeNull();
    expect(commentContentValidator(new FormControl('   '))).toBeNull();
  });

  it('validator reports content problems for non-empty controls', () => {
    const error = commentContentValidator(new FormControl('visit evil.com'));

    expect(error?.['commentContent']).toMatchObject({ reason: 'url' });
  });
});
