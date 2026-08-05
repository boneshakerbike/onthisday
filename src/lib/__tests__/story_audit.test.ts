import { describe, it, expect } from 'vitest';
import { build_story_audit, AuditableSourcePost, StoryAuditIssueType } from '../story_audit';

function audit_one(content_html: string | null) {
  const post: AuditableSourcePost = {
    post_id: '2011-05-19.a-ride-in-the-hills',
    title: 'A Ride In The Hills',
    url: 'https://8i11.substack.com/p/a-ride-in-the-hills',
    content_html,
  };

  return build_story_audit([post]).sources[0];
}

function types_of(content_html: string | null): StoryAuditIssueType[] {
  return audit_one(content_html).issues.map(issue => issue.type);
}

const LONG_POST = [
  '<p>The climb out of town was colder than expected.</p>',
  '<p>We stopped at the cafe halfway up and argued about tyre pressure.</p>',
  '<p>By the summit the fog had burned off completely.</p>',
  '<p>Descending, the road was still damp in the shaded corners.</p>',
  '<p>We were home before the rain came back in.</p>',
].join('');

describe('broken markup detection', () => {
  it('flags a gallery shortcode left as plain text', () => {
    const source = audit_one(`<p>Photos from the day.</p><p>[gallery ids="112,113,114"]</p>${LONG_POST}`);
    const issue = source.issues.find(i => i.type === 'broken_markup');

    expect(issue).toBeDefined();
    expect(issue!.message).toContain('[gallery ids="112,113,114"]');
    expect(issue!.message).toContain('no images');
  });

  it('does not claim images are missing when the gallery shortcode sits beside real images', () => {
    const source = audit_one(
      `<p>[gallery]</p><img src="https://substackcdn.com/photo.jpg">${LONG_POST}`
    );
    const issue = source.issues.find(i => i.type === 'broken_markup');

    expect(issue).toBeDefined();
    expect(issue!.message).not.toContain('no images');
  });

  it('flags other WordPress shortcodes and leftover block comments', () => {
    expect(types_of(`<p>[caption id="attachment_42"]Summit[/caption]</p>${LONG_POST}`)).toContain(
      'broken_markup'
    );
    expect(types_of(`<!-- wp:gallery {"ids":[1,2]} -->${LONG_POST}`)).toContain('broken_markup');
  });

  it('reports each distinct shortcode once', () => {
    const source = audit_one(`<p>[gallery]</p><p>[gallery]</p><p>[embed]</p>${LONG_POST}`);
    const markup_issues = source.issues.filter(i => i.type === 'broken_markup');

    expect(markup_issues).toHaveLength(2);
  });

  it('reads an opening and closing shortcode pair as one problem', () => {
    const source = audit_one(
      `<p>[caption id="attachment_42" width="640"]Summit[/caption]</p>${LONG_POST}`
    );

    expect(source.issues.filter(i => i.type === 'broken_markup')).toHaveLength(1);
  });

  it('does not let leaked shortcodes pad the sentence count', () => {
    const types = types_of('<p>Photos below.</p><p>[gallery ids="1,2"]</p><p>[embed]</p>');
    expect(types).toContain('post_too_short');
  });

  it('flags entity-escaped HTML that renders as plain text', () => {
    const types = types_of(`<p>&lt;img src="https://example.com/a.jpg" /&gt;</p>${LONG_POST}`);
    expect(types).toContain('broken_markup');
  });

  it('leaves clean posts alone', () => {
    expect(types_of(LONG_POST)).toEqual([]);
  });

  it('does not treat ordinary bracketed prose as a shortcode', () => {
    expect(types_of(`<p>[not a shortcode] and [1] a footnote.</p>${LONG_POST}`)).toEqual([]);
  });
});

describe('missing image detection', () => {
  it('flags images hosted on imgur', () => {
    const source = audit_one(`<p><img src="https://i.imgur.com/abc123.jpg"></p>${LONG_POST}`);
    const issue = source.issues.find(i => i.type === 'missing_images');

    expect(issue).toBeDefined();
    expect(issue!.message).toContain('https://i.imgur.com/abc123.jpg');
  });

  it('flags imgur links and bare imgur URLs left in the text', () => {
    expect(types_of(`<p><a href="https://imgur.com/a/xYz">photos</a></p>${LONG_POST}`)).toContain(
      'missing_images'
    );
    expect(types_of(`<p>Photos: https://imgur.com/a/xYz</p>${LONG_POST}`)).toContain(
      'missing_images'
    );
  });

  it('reports a repeated imgur URL once', () => {
    const source = audit_one(
      `<p><img src="https://i.imgur.com/abc123.jpg"></p><p><img src="https://i.imgur.com/abc123.jpg"></p>${LONG_POST}`
    );

    expect(source.issues.filter(i => i.type === 'missing_images')).toHaveLength(1);
  });

  it('ignores images on hosts that still work', () => {
    expect(types_of(`<p><img src="https://substackcdn.com/a.jpg"></p>${LONG_POST}`)).toEqual([]);
  });

  it('does not match a lookalike host', () => {
    expect(types_of(`<p><img src="https://notimgur.com/a.jpg"></p>${LONG_POST}`)).toEqual([]);
  });
});

describe('short post detection', () => {
  it('flags a one-sentence post', () => {
    const source = audit_one('<p>We rode to the coast and back.</p>');
    const issue = source.issues.find(i => i.type === 'post_too_short');

    expect(issue).toBeDefined();
    expect(issue!.message).toContain('1 sentence');
  });

  it('flags a three-sentence post', () => {
    const source = audit_one('<p>It rained. We rode anyway. It was worth it.</p>');
    const issue = source.issues.find(i => i.type === 'post_too_short');

    expect(issue).toBeDefined();
    expect(issue!.message).toContain('3 sentences');
  });

  it('does not flag a four-sentence post', () => {
    expect(
      types_of('<p>It rained. We rode anyway. It was worth it. We slept well.</p>')
    ).not.toContain('post_too_short');
  });

  it('counts paragraphs without terminal punctuation as separate sentences', () => {
    const html = '<p>Cold start</p><p>Long climb</p><p>Fast descent</p><p>Home by four</p>';
    expect(types_of(html)).not.toContain('post_too_short');
  });

  it('counts list items as separate sentences', () => {
    const html = '<ul><li>Bike</li><li>Pump</li><li>Spare tube</li><li>Snacks</li></ul>';
    expect(types_of(html)).not.toContain('post_too_short');
  });

  it('does not double-report an empty post as both missing content and too short', () => {
    const types = types_of('');
    expect(types).toContain('missing_content');
    expect(types).not.toContain('post_too_short');
  });

  it('ignores markup-only content with no readable text', () => {
    expect(types_of('<p><img src="https://substackcdn.com/a.jpg"></p>')).not.toContain(
      'post_too_short'
    );
  });
});

describe('audit summary', () => {
  it('counts sources with issues across the story', () => {
    const audit = build_story_audit([
      { post_id: 'a', title: 'A', url: 'https://x/a', content_html: LONG_POST },
      {
        post_id: 'b',
        title: 'B',
        url: 'https://x/b',
        content_html: '<p>Short one.</p><p><img src="https://i.imgur.com/z.jpg"></p>',
      },
    ]);

    expect(audit.summary.source_count).toBe(2);
    expect(audit.summary.sources_with_issues).toBe(1);
    expect(audit.summary.issue_count).toBe(2);
  });

  it('still reports the pre-existing structural checks', () => {
    const types = types_of(
      `<p><a>no href</a></p><p><a href="https://example.com"></a></p><p><img></p>${LONG_POST}`
    );

    expect(types).toContain('missing_href');
    expect(types).toContain('missing_src');
    expect(types).toContain('empty_anchor');
  });
});
