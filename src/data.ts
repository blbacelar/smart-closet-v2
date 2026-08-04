export type Category = 'All' | 'Tops' | 'Bottoms' | 'Dresses' | 'Outerwear';

export type Garment = {
  id: string;
  name: string;
  category: Exclude<Category, 'All'>;
  color: string;
  size: string;
  season: string;
  image: string;
  worn?: number;
};

export const bodyPhoto =
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85';

export const garments: Garment[] = [
  {
    id: '1',
    name: 'Linen button-up',
    category: 'Tops',
    color: 'Oat',
    size: 'M',
    season: 'Summer',
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=85',
    worn: 6,
  },
  {
    id: '2',
    name: 'Sage knit',
    category: 'Tops',
    color: 'Sage',
    size: 'M',
    season: 'Fall',
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=700&q=85',
    worn: 4,
  },
  {
    id: '3',
    name: 'Wide-leg trousers',
    category: 'Bottoms',
    color: 'Espresso',
    size: '6',
    season: 'All year',
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=700&q=85',
    worn: 8,
  },
  {
    id: '4',
    name: 'Sunday midi dress',
    category: 'Dresses',
    color: 'Terracotta',
    size: 'M',
    season: 'Summer',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=85',
    worn: 3,
  },
  {
    id: '5',
    name: 'Vintage denim jacket',
    category: 'Outerwear',
    color: 'Indigo',
    size: 'M',
    season: 'Spring',
    image: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=700&q=85',
    worn: 12,
  },
  {
    id: '6',
    name: 'Silk evening top',
    category: 'Tops',
    color: 'Black',
    size: 'S',
    season: 'All year',
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=700&q=85',
    worn: 2,
  },
];
