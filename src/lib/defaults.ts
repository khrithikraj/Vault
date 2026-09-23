import type { Category, FieldDefinition } from '../types/app'
 
const foodFields: FieldDefinition[] = [
  { key: 'title', label: 'Place name', type: 'text', required: true },
  { key: 'dish', label: 'Dish to try', type: 'text', required: true },
  { key: 'address', label: 'Address', type: 'text', required: false },
  { key: 'price', label: 'Price', type: 'number', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const buyFields: FieldDefinition[] = [
  { key: 'title', label: 'Item name', type: 'text', required: true },
  { key: 'link', label: 'Where to buy / link', type: 'url', required: false },
  { key: 'price', label: 'Price', type: 'number', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const wishlistFields: FieldDefinition[] = [
  { key: 'title', label: 'Item name', type: 'text', required: true },
  { key: 'brand', label: 'Brand', type: 'text', required: false },
  { key: 'price', label: 'Price', type: 'number', required: false },
  { key: 'link', label: 'Link', type: 'url', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]
 
const movieFields: FieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'genre', label: 'Genre', type: 'text', required: false },
  { key: 'platform', label: 'Platform', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]
 
const templeFields: FieldDefinition[] = [
  { key: 'title', label: 'Name', type: 'text', required: true },
  { key: 'location', label: 'Location', type: 'text', required: false },
  { key: 'best_time', label: 'Best time to visit', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]
 
const educationFields: FieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'link', label: 'Source / link', type: 'url', required: false },
  { key: 'topic', label: 'Topic', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]
 
const placesFields: FieldDefinition[] = [
  { key: 'title', label: 'Name', type: 'text', required: true },
  { key: 'location', label: 'Location', type: 'text', required: false },
  { key: 'best_season', label: 'Best season', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]
 
export const defaultCategorySeeds: Array<
  Pick<
    Category,
    'name' | 'description' | 'color' | 'icon' | 'is_default' | 'field_schema' | 'category_schema_version'
  >
> = [
  {
    name: 'Food Spots',
    description: 'Restaurants, cafes and dishes worth trying.',
    color: '#ffd9c3',
    icon: '🍜',
    is_default: true,
    category_schema_version: 1,
    field_schema: foodFields,
  },
  {
    name: 'Things To Buy',
    description: 'Real purchases I want to make or check out.',
    color: '#cfe7ff',
    icon: '🛍️',
    is_default: true,
    category_schema_version: 1,
    field_schema: buyFields,
  },
  {
    name: 'Shopping Wishlist',
    description: 'Wishlist items I am watching and comparing.',
    color: '#dbf4cb',
    icon: '⌚',
    is_default: true,
    category_schema_version: 1,
    field_schema: wishlistFields,
  },
  {
    name: 'Movies & Series',
    description: 'Shows and films I want to watch.',
    color: '#e4d7ff',
    icon: '🎬',
    is_default: true,
    category_schema_version: 1,
    field_schema: movieFields,
  },
  {
    name: 'Temples',
    description: 'Temples and spiritual places to visit.',
    color: '#ffe9b8',
    icon: '🛕',
    is_default: true,
    category_schema_version: 1,
    field_schema: templeFields,
  },
  {
    name: 'Education Reels',
    description: 'Reels and links worth learning from.',
    color: '#ccf5ec',
    icon: '📚',
    is_default: true,
    category_schema_version: 1,
    field_schema: educationFields,
  },
  {
    name: 'Places To Visit',
    description: 'Destinations and spots on the travel list.',
    color: '#ffd3d8',
    icon: '📍',
    is_default: true,
    category_schema_version: 1,
    field_schema: placesFields,
  },
]
