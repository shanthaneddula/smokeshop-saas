'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

interface CatalogProduct {
  _id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  suggestedRetailPrice: number;
  wholesalePrice: number;
  images: string[];
  primaryImage: string;
  isAvailable: boolean;
}

interface CatalogSearchProps {
  onProductAdded?: () => void;
  onClose?: () => void;
}

export default function CatalogSearch({ onProductAdded, onClose }: CatalogSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  
  // Form state for linking product
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [linking, setLinking] = useState(false);

  const searchCatalog = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const params = new URLSearchParams({ query: searchQuery });
      const response = await fetch(`/api/products/catalog/search?${params}`);
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setSearchResults(data.products);
    } catch (error) {
      console.error('Error searching catalog:', error);
      alert('Failed to search catalog');
    } finally {
      setSearching(false);
    }
  };

  const selectProduct = (product: CatalogProduct) => {
    setSelectedProduct(product);
    // Pre-fill with suggested prices
    setCostPrice(product.wholesalePrice?.toString() || '');
    setSalePrice(product.suggestedRetailPrice?.toString() || '');
    setQuantity('0');
  };

  const linkProduct = async () => {
    if (!selectedProduct) return;
    
    const cost = parseFloat(costPrice);
    const sale = parseFloat(salePrice);
    const qty = parseInt(quantity);
    
    if (isNaN(cost) || cost < 0) {
      alert('Invalid cost price');
      return;
    }
    
    if (isNaN(sale) || sale < 0) {
      alert('Invalid sale price');
      return;
    }
    
    if (isNaN(qty) || qty < 0) {
      alert('Invalid quantity');
      return;
    }
    
    setLinking(true);
    try {
      const response = await fetch('/api/products/link-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterProductId: selectedProduct._id,
          costPrice: cost,
          salePrice: sale,
          stockQuantity: qty,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add product');
      }
      
      alert('Product added to your inventory!');
      setSelectedProduct(null);
      setSearchResults([]);
      setSearchQuery('');
      onProductAdded?.();
      onClose?.();
    } catch (error) {
      console.error('Error linking product:', error);
      alert(error instanceof Error ? error.message : 'Failed to add product');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div>
        <Label htmlFor="catalog-search">Search Master Catalog</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="catalog-search"
            type="search"
            placeholder="Search by product name, brand, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchCatalog()}
          />
          <Button onClick={searchCatalog} disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && !selectedProduct && (
        <div>
          <h3 className="font-semibold mb-3">Search Results ({searchResults.length})</h3>
          <div className="grid gap-3 max-h-96 overflow-y-auto">
            {searchResults.map((product) => (
              <Card key={product._id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-slate-100 rounded flex-shrink-0 overflow-hidden">
                    {product.primaryImage ? (
                      <img 
                        src={product.primaryImage} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">
                        📦
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{product.name}</h4>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">{product.brand}</span> • {product.category}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      Barcode: <span className="font-mono">{product.barcode}</span>
                    </div>
                    <div className="flex gap-4 mt-2">
                      {product.wholesalePrice > 0 && (
                        <div className="text-sm">
                          Wholesale: <span className="font-semibold">${product.wholesalePrice.toFixed(2)}</span>
                        </div>
                      )}
                      {product.suggestedRetailPrice > 0 && (
                        <div className="text-sm">
                          MSRP: <span className="font-semibold">${product.suggestedRetailPrice.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Select Button */}
                  <div className="flex-shrink-0">
                    <Button 
                      size="sm"
                      onClick={() => selectProduct(product)}
                      disabled={!product.isAvailable}
                    >
                      {product.isAvailable ? 'Select' : 'Unavailable'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Product Link Form */}
      {selectedProduct && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">{selectedProduct.name}</h3>
              <p className="text-sm text-slate-600">{selectedProduct.brand} • {selectedProduct.category}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedProduct(null)}
            >
              ← Back to Results
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="cost-price">Your Cost Price *</Label>
              <Input
                id="cost-price"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="sale-price">Your Sale Price *</Label>
              <Input
                id="sale-price"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="quantity">Starting Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={linkProduct}
              disabled={linking || !costPrice || !salePrice}
              className="flex-1"
            >
              {linking ? 'Adding...' : 'Add to Inventory'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setSelectedProduct(null)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}
      
      {/* No Results */}
      {searchResults.length === 0 && searchQuery && !searching && (
        <div className="text-center py-8 text-slate-600">
          No products found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}
