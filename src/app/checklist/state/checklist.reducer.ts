import { createSelector } from '@ngrx/store';
import {
  BreadcrumbItem,
  Category,
  CategoryEntity,
  CategoryMap,
  Checklist,
  ChecklistFilter,
  ChecklistItem,
  Favorite,
  FavoriteEntity,
  ItemMap
} from '../models/checklist';
import { computeScore, filterItems, setCheckedState, updateFavorites, calculatePercentage } from '../utils/checklist';
import { extractRouteParams } from '../utils/router';
import { ChecklistActionTypes, ChecklistActions } from './checklist.actions';
import { ApplicationState } from './index';

const CHECKLIST: Checklist = require('../../../assets/content.json');

export interface ChecklistState {
  categories: CategoryMap;
  items: ItemMap;
  filter: ChecklistFilter;
  favorites: FavoriteEntity;
}

export const INITIAL_STATE: ChecklistState = {
  ...CHECKLIST,
  filter: 'ALL',
  favorites: {}
};

export function checklistReducer(state = INITIAL_STATE, action: ChecklistActions) {
  switch (action.type) {
    case ChecklistActionTypes.SET_FILTER:
      return {
        ...state,
        filter: action.payload
      };
    case ChecklistActionTypes.CHECK_ALL:
      return {
        ...state,
        items: setCheckedState(action.payload, state.categories, state.items, true)
      };
    case ChecklistActionTypes.UNCHECK_ALL:
      return {
        ...state,
        items: setCheckedState(action.payload, state.categories, state.items, false)
      };
    case ChecklistActionTypes.TOGGLE_FAVORITE:
      return {
        ...state,
        items: itemsReducer(state.items, action),
        favorites: favoritesReducer(state.favorites, action)
      };
    case ChecklistActionTypes.TOGGLE:
      return {
        ...state,
        items: itemsReducer(state.items, action)
      };
    default:
      return state;
  }
}

export const itemsReducer = (state: ItemMap, action: ChecklistActions) => {
  switch (action.type) {
    case ChecklistActionTypes.TOGGLE_FAVORITE:
      const id = action.payload.id;

      return {
        ...state,
        [id]: { ...state[id], favorite: !state[id].favorite }
      };
    case ChecklistActionTypes.TOGGLE:
      const item = state[action.payload.id];

      return {
        ...state,
        [action.payload.id]: { ...item, checked: !item.checked }
      };
    default:
      return state;
  }
};

export const favoritesReducer = (state: FavoriteEntity, action: ChecklistActions) => {
  switch (action.type) {
    case ChecklistActionTypes.TOGGLE_FAVORITE:
      const categoryId = action.payload.category;
      const updatedFavorites = updateFavorites(state[categoryId], action.payload.id);
      const updateState = { ...state };

      if (updatedFavorites.length) {
        updateState[categoryId] = updatedFavorites;
      } else {
        delete updateState[categoryId];
      }

      return updateState;
    default:
      return state;
  }
};

export namespace ChecklistQueries {
  export const getCategoriesEntity = (state: ApplicationState) => state.checklist.categories;
  export const getItemsEntity = (state: ApplicationState) => state.checklist.items;
  export const getRouterState = (state: ApplicationState) => state.router.state;
  export const getFilter = (state: ApplicationState) => state.checklist.filter;
  export const getFavoriteEntity = (state: ApplicationState) => state.checklist.favorites;

  export const getScores = createSelector(getCategoriesEntity, getItemsEntity, (categories, items) => {
    return Object.keys(categories).reduce((acc, categoryId) => {
      acc[categoryId] = computeScore(categories[categoryId].items, items);
      return acc;
    }, {});
  });

  export const getCategories = createSelector(
    getCategoriesEntity,
    getItemsEntity,
    getScores,
    (categories, items, scores): Array<Category> => {
      return Object.keys(categories).map(categoryId => {
        const category = categories[categoryId];
        const categoryItems = category.items.map(itemId => items[itemId]);
        return { ...category, score: scores[categoryId], items: categoryItems } as Category;
      });
    }
  );

  export const getSelectedCategory = createSelector(
    getRouterState,
    getCategoriesEntity,
    getScores,
    (routerState, categories, scores): CategoryEntity => {
      const { category } = extractRouteParams(routerState.root, 4);
      return category ? { ...categories[category], score: scores[category] } : null;
    }
  );

  export const getItemsFromSelectedCategory = createSelector(
    getCategoriesEntity,
    getItemsEntity,
    getSelectedCategory,
    getFilter,
    (categories, items, selectedCategory, filter): Array<ChecklistItem> => {
      if (selectedCategory) {
        const category = categories[selectedCategory.slug];
        return filterItems(category.items.map(id => items[id]), filter);
      }

      return null;
    }
  );

  export const getSelectedItem = createSelector(
    getSelectedCategory,
    getItemsEntity,
    getRouterState,
    (category, items, routerState): ChecklistItem => {
      if (category) {
        const { item: id } = extractRouteParams(routerState.root, 4);
        return items[id];
      }

      return null;
    }
  );

  export const getFavorites = createSelector(
    getFavoriteEntity,
    getCategoriesEntity,
    getItemsEntity,
    (favorites, categories, items): Array<Favorite> => {
      return Object.keys(favorites).reduce((acc, categoryId) => {
        acc.push({
          category: categories[categoryId],
          items: favorites[categoryId].map(itemId => items[itemId])
        });

        return acc;
      }, []);
    }
  );

  export const getFavoritesScore = createSelector(getFavorites, favorites => {
    if (favorites.length) {
      const score = favorites.reduce(
        (acc, favorite) => {
          acc.checkedItems += favorite.items.filter(item => item.checked).length;
          acc.totalItems += favorite.items.length;
          return acc;
        },
        { checkedItems: 0, totalItems: 0 }
      );

      return calculatePercentage(score.checkedItems, score.totalItems);
    }

    return 0;
  });

  export const getFavoritesCount = createSelector(getFavorites, favorites => {
    return favorites.reduce((acc, category) => {
      return acc + category.items.length;
    }, 0);
  });

  export const getBreadcrumb = createSelector(getSelectedCategory, getSelectedItem, (category, item) => {
    const breadcrumb: Array<BreadcrumbItem> = [];

    if (category) {
      breadcrumb.push(category);
    }

    if (item) {
      breadcrumb.push(item);
    }

    return breadcrumb;
  });
}