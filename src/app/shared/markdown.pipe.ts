import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

/**
 * Converts a Markdown string into an HTML string.
 *
 * The result is intended to be bound through Angular's `[innerHTML]`, which
 * sanitizes the markup and strips any unsafe content (scripts, event handlers,
 * dangerous URL schemes) before it reaches the DOM.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value?.trim()) {
      return '';
    }

    return marked.parse(value, { async: false, gfm: true, breaks: true });
  }
}
