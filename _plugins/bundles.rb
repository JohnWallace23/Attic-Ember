# Buy-together bundle deals, and the product facts the cart needs.
#
# _data/bundles.yml is written by the sourcing app's Bundle button (through
# tools/publish/sitechanges.py): a list of {id, items: [slugs], price}. The
# pieces stay listed on their own; a bundle is a discount when every piece of
# it is in the cart together.
#
# A bundle only counts when all of its pieces exist, aren't sold or drafts,
# there are 2-4 of them, and its price is above zero and below what the pieces
# cost separately. Anything else is skipped, so a sold piece quietly ends the
# deal everywhere at the next build.
#
# Before the pages render this gives each product `bundle_deals` (shown on its
# page) and puts `site.data["shop_json"]` together: current price, sold flag and
# shipping for every product, plus the valid bundles. cart.js reads that to
# keep a cart's prices current and to apply the discounts.
require "json"

module ShopBundles
  SLUG = /\A[a-z0-9-]{1,80}\z/

  def self.slug(doc)
    File.basename(doc.path, ".*")
  end

  def self.price(value)
    Float(value).round(2)
  rescue ArgumentError, TypeError
    nil
  end

  def self.valid_bundles(raw, by_slug)
    return [] unless raw.is_a?(Array)
    raw.filter_map do |b|
      next unless b.is_a?(Hash)
      items = Array(b["items"]).map(&:to_s).uniq
      next unless (2..4).cover?(items.size) && items.all? { |s| s.match?(SLUG) }
      docs = items.map { |s| by_slug[s] }
      next if docs.any? { |d| d.nil? || d.data["sold"] || d.data["draft"] }
      prices = docs.map { |d| price(d.data["price"]) }
      next if prices.any?(&:nil?)
      total = prices.sum.round(2)
      deal = price(b["price"])
      next if deal.nil? || deal <= 0 || deal >= total
      { "id" => b["id"].to_s, "items" => items, "price" => deal, "sum" => total, "save" => (total - deal).round(2) }
    end
  end
end

Jekyll::Hooks.register :site, :pre_render do |site|
  products = site.collections["products"]
  next if products.nil?

  by_slug = products.docs.to_h { |d| [ShopBundles.slug(d), d] }
  bundles = ShopBundles.valid_bundles(site.data["bundles"], by_slug)

  products.docs.each { |d| d.data["bundle_deals"] = [] }
  bundles.each do |b|
    b["items"].each do |s|
      partners = (b["items"] - [s]).map do |o|
        od = by_slug[o]
        { "slug" => o, "title" => od.data["title"].to_s, "url" => od.url }
      end
      by_slug[s].data["bundle_deals"] << b.merge("partners" => partners)
    end
  end

  facts = by_slug.to_h do |s, d|
    [s, { "title" => d.data["title"].to_s, "price" => ShopBundles.price(d.data["price"]),
          "sold" => d.data["sold"] == true, "url" => d.url,
          "image" => Array(d.data["images"]).first || d.data["image"],
          "freeShip" => d.data["free_shipping"] == true,
          "ship" => d.data["shipping"] }]
  end
  # Safe inside <script type="application/json">: no "</" can close the tag early.
  site.data["shop_json"] = JSON.generate({ "products" => facts, "bundles" => bundles }).gsub("</", "<\\/")
end
