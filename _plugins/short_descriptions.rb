# Search engines show a page's meta description as the blurb under its link,
# and want it under about 160 characters (Bing flags anything longer). A
# product's `description` is its full listing text, often 300+ characters,
# and jekyll-seo-tag copies it into the meta description as-is.
#
# So before the page renders, this keeps the full text in `description_full`
# (which the product page and its structured data show) and gives
# `description` a short version: as many whole opening sentences as fit in
# 155 characters, or, if even the first is longer, that sentence cut at a
# word with "…". Nothing changes in the product files themselves.
module ShortDescriptions
  LIMIT = 155

  def self.plain(text)
    text.to_s.gsub(/<[^>]+>/, " ").gsub(/\s+/, " ").strip
  end

  def self.shorten(text)
    t = plain(text)
    return t if t.length <= LIMIT

    # A sentence ends at . ! or ? (plus any closing quote) when the next word
    # starts a new sentence, so a title like “Which Witch?” mid-sentence doesn't.
    out = ""
    t.scan(/.+?(?:[.!?]+["”’)]*(?=\s+["“‘(]?[A-Z0-9])|\z)\s*/).each do |sentence|
      break if (out + sentence).strip.length > LIMIT
      out << sentence
    end
    out = out.strip
    return out if out.length >= 60   # a real sentence or two, not a fragment

    cut = t[0, LIMIT - 1]
    cut = cut[0, cut.rindex(" ")] if cut.include?(" ")
    cut.sub(/[\s,;:—–-]+\z/, "") + "…"
  end
end

Jekyll::Hooks.register :site, :pre_render do |site|
  products = site.collections["products"]
  next if products.nil?

  products.docs.each do |doc|
    full = doc.data["description"]
    next unless full.is_a?(String) && !full.strip.empty?

    doc.data["description_full"] = full
    doc.data["description"] = ShortDescriptions.shorten(full)
  end
end
