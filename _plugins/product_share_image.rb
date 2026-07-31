# When a product page is shared (text message, Facebook, Discord…), show
# that product's own photo rather than the generic site image.
#
# jekyll-seo-tag reads `page["image"]` only, and products store their photos
# in an `images:` list, so this copies the first photo into `image` before
# the page renders. An explicit `image:` in a product's front matter always
# wins, and products with no photos fall back to the site default.
Jekyll::Hooks.register :site, :pre_render do |site|
  products = site.collections["products"]
  next if products.nil?

  fallback = "/assets/img/og-default.jpg"

  products.docs.each do |doc|
    existing = doc.data["image"]
    next if existing.is_a?(String) && !existing.empty?

    photos = doc.data["images"]
    doc.data["image"] =
      if photos.is_a?(Array) && !photos.empty?
        photos.first
      else
        fallback   # a product with no photos still gets a share image
      end
  end
end
