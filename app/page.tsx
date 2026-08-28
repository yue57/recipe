'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  updatedAt: string;
};

type RecipeIngredient = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
};

type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  notes: string;
  updatedAt: string;
};

type AppData = {
  ingredients: Ingredient[];
  recipes: Recipe[];
};

type Tab = 'cook' | 'inventory' | 'recipes';

const STORAGE_KEY = 'kitchen-planner-v1';
const UNIT_OPTIONS = ['克', '个', '颗', '根', '片', '勺', '毫升', '瓶', '包', '份'];

const sampleData: AppData = {
  ingredients: [
    {
      id: 'ing-rice',
      name: '大米',
      unit: '克',
      quantity: 900,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ing-egg',
      name: '鸡蛋',
      unit: '个',
      quantity: 6,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ing-tomato',
      name: '番茄',
      unit: '个',
      quantity: 3,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ing-onion',
      name: '小葱',
      unit: '克',
      quantity: 40,
      updatedAt: new Date().toISOString(),
    },
  ],
  recipes: [
    {
      id: 'rec-tomato-egg',
      name: '番茄炒蛋',
      servings: 1,
      notes: '适合配米饭，出锅前再调味。',
      updatedAt: new Date().toISOString(),
      ingredients: [
        { id: 'need-egg', name: '鸡蛋', unit: '个', quantity: 2 },
        { id: 'need-tomato', name: '番茄', unit: '个', quantity: 1 },
        { id: 'need-onion', name: '小葱', unit: '克', quantity: 5 },
      ],
    },
    {
      id: 'rec-rice',
      name: '白米饭',
      servings: 1,
      notes: '按家里的量杯习惯调整。',
      updatedAt: new Date().toISOString(),
      ingredients: [{ id: 'need-rice', name: '大米', unit: '克', quantity: 90 }],
    },
  ],
};

const emptyData: AppData = {
  ingredients: [],
  recipes: [],
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeName = (name: string) => name.trim();

const formatAmount = (value: number) => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const ingredientKey = (name: string) => normalizeName(name).toLowerCase();
const toWholeNumber = (value: string | number) => Math.max(Math.round(Number(value) || 0), 0);

function loadData(): AppData {
  if (typeof window === 'undefined') return emptyData;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return sampleData;

  try {
    const parsed = JSON.parse(stored) as AppData;
    return {
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
    };
  } catch {
    return sampleData;
  }
}

function getAvailability(recipe: Recipe, ingredients: Ingredient[], targetServings: number) {
  const ratio = targetServings / recipe.servings;
  const inventory = new Map(ingredients.map((item) => [ingredientKey(item.name), item]));
  const requiredIngredients = recipe.ingredients.map((item) => {
    const requiredQuantity = item.quantity * ratio;
    const stock = inventory.get(ingredientKey(item.name));
    const availableQuantity = stock?.quantity ?? 0;
    const unitMatches = !stock || stock.unit === item.unit;

    return {
      ...item,
      requiredQuantity,
      availableQuantity,
      unitMatches,
      missingQuantity: unitMatches ? Math.max(requiredQuantity - availableQuantity, 0) : requiredQuantity,
      stockUnit: stock?.unit,
    };
  });

  const missingIngredients = requiredIngredients.filter(
    (item) => !item.unitMatches || item.availableQuantity < item.requiredQuantity,
  );

  return {
    canCook: missingIngredients.length === 0,
    requiredIngredients,
    missingIngredients,
  };
}

export default function Home() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [tab, setTab] = useState<Tab>('cook');
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [targetServings, setTargetServings] = useState('');
  const [toast, setToast] = useState('');

  const [ingredientName, setIngredientName] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState('克');
  const [ingredientQuantity, setIngredientQuantity] = useState('');

  const [recipeName, setRecipeName] = useState('');
  const [recipeServings, setRecipeServings] = useState('1');
  const [recipeNotes, setRecipeNotes] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([
    { id: uid(), name: '', unit: '克', quantity: 0 },
  ]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const activeRecipeId = selectedRecipeId || data.recipes[0]?.id || '';
  const selectedRecipe = data.recipes.find((recipe) => recipe.id === activeRecipeId);
  const parsedTargetServings = Math.max(toWholeNumber(targetServings) || selectedRecipe?.servings || 1, 1);

  const selectedAvailability = selectedRecipe
    ? getAvailability(selectedRecipe, data.ingredients, parsedTargetServings)
    : null;

  const cookableRecipes = useMemo(
    () =>
      data.recipes.map((recipe) => ({
        recipe,
        availability: getAvailability(recipe, data.ingredients, recipe.servings),
      })),
    [data.ingredients, data.recipes],
  );

  const filteredIngredients = data.ingredients.filter((item) =>
    item.name.toLowerCase().includes(inventorySearch.trim().toLowerCase()),
  );

  const lowStockCount = data.ingredients.filter((item) => item.quantity <= 0).length;
  const canCookCount = cookableRecipes.filter((item) => item.availability.canCook).length;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const addIngredient = (event: FormEvent) => {
    event.preventDefault();
    const name = normalizeName(ingredientName);
    const unit = normalizeName(ingredientUnit);
    const quantity = toWholeNumber(ingredientQuantity);

    if (!name || !unit || quantity < 0) {
      showToast('请填写有效的食材名称、单位和数量。');
      return;
    }

    setData((current) => {
      const existing = current.ingredients.find((item) => ingredientKey(item.name) === ingredientKey(name));
      if (existing) {
        return {
          ...current,
          ingredients: current.ingredients.map((item) =>
            item.id === existing.id
              ? { ...item, unit, quantity, updatedAt: new Date().toISOString() }
              : item,
          ),
        };
      }

      return {
        ...current,
        ingredients: [
          { id: uid(), name, unit, quantity, updatedAt: new Date().toISOString() },
          ...current.ingredients,
        ],
      };
    });

    setIngredientName('');
    setIngredientQuantity('');
    showToast('库存已保存。');
  };

  const updateIngredientQuantity = (id: string, quantity: number) => {
    setData((current) => ({
      ...current,
      ingredients: current.ingredients.map((item) =>
        item.id === id ? { ...item, quantity: toWholeNumber(quantity), updatedAt: new Date().toISOString() } : item,
      ),
    }));
  };

  const deleteIngredient = (id: string) => {
    setData((current) => ({
      ...current,
      ingredients: current.ingredients.filter((item) => item.id !== id),
    }));
    showToast('食材已删除。');
  };

  const addRecipeIngredientRow = () => {
    setRecipeIngredients((current) => [...current, { id: uid(), name: '', unit: '克', quantity: 0 }]);
  };

  const updateRecipeIngredient = (
    id: string,
    field: keyof Omit<RecipeIngredient, 'id'>,
    value: string,
  ) => {
    setRecipeIngredients((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === 'quantity' ? toWholeNumber(value) : value,
            }
          : item,
      ),
    );
  };

  const removeRecipeIngredient = (id: string) => {
    setRecipeIngredients((current) => {
      if (current.length === 1) return current;
      return current.filter((item) => item.id !== id);
    });
  };

  const addRecipe = (event: FormEvent) => {
    event.preventDefault();
    const name = normalizeName(recipeName);
    const servings = toWholeNumber(recipeServings);
    const ingredients = recipeIngredients
      .map((item) => ({
        ...item,
        name: normalizeName(item.name),
        unit: normalizeName(item.unit),
        quantity: toWholeNumber(item.quantity),
      }))
      .filter((item) => item.name && item.unit && item.quantity > 0);

    if (!name || servings <= 0 || ingredients.length === 0) {
      showToast('请填写菜名、份数，并至少添加一种食材。');
      return;
    }

    const recipe: Recipe = {
      id: uid(),
      name,
      servings,
      ingredients,
      notes: recipeNotes.trim(),
      updatedAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      recipes: [recipe, ...current.recipes],
    }));
    setSelectedRecipeId(recipe.id);
    setTargetServings(String(servings));
    setRecipeName('');
    setRecipeServings('1');
    setRecipeNotes('');
    setRecipeIngredients([{ id: uid(), name: '', unit: '克', quantity: 0 }]);
    setTab('cook');
    showToast('菜谱已保存。');
  };

  const deleteRecipe = (id: string) => {
    setData((current) => ({
      ...current,
      recipes: current.recipes.filter((recipe) => recipe.id !== id),
    }));
    if (selectedRecipeId === id) setSelectedRecipeId('');
    showToast('菜谱已删除。');
  };

  const cookSelectedRecipe = () => {
    if (!selectedRecipe || !selectedAvailability) return;

    if (!selectedAvailability.canCook) {
      showToast('库存还不够，先补齐缺少食材。');
      return;
    }

    setData((current) => ({
      ...current,
      ingredients: current.ingredients.map((item) => {
        const required = selectedAvailability.requiredIngredients.find(
          (need) => ingredientKey(need.name) === ingredientKey(item.name),
        );

        if (!required) return item;

        return {
          ...item,
          quantity: Math.max(item.quantity - required.requiredQuantity, 0),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    showToast(`已扣减「${selectedRecipe.name}」所需库存。`);
  };

  const resetSampleData = () => {
    setData(sampleData);
    setSelectedRecipeId(sampleData.recipes[0]?.id ?? '');
    setTargetServings(String(sampleData.recipes[0]?.servings ?? 1));
    showToast('已恢复示例数据。');
  };

  return (
    <main className="min-h-screen bg-[#f7f3ed] text-[#1f2520]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:grid lg:grid-cols-[360px_1fr]">
        <section className="bg-[#224234] px-5 pb-6 pt-5 text-white lg:min-h-screen lg:px-8 lg:py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#bfe4d0]">Kitchen Stock</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">今日能做什么</h1>
            </div>
            <button
              type="button"
              onClick={resetSampleData}
              className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-semibold text-white"
            >
              示例
            </button>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white/12 p-3">
              <p className="text-2xl font-bold">{data.ingredients.length}</p>
              <p className="mt-1 text-xs text-white/72">库存食材</p>
            </div>
            <div className="rounded-lg bg-white/12 p-3">
              <p className="text-2xl font-bold">{data.recipes.length}</p>
              <p className="mt-1 text-xs text-white/72">已存菜谱</p>
            </div>
            <div className="rounded-lg bg-white/12 p-3">
              <p className="text-2xl font-bold">{canCookCount}</p>
              <p className="mt-1 text-xs text-white/72">现在可做</p>
            </div>
          </div>

          {lowStockCount > 0 ? (
            <p className="mt-4 rounded-lg bg-[#f4c95d] px-4 py-3 text-sm font-semibold text-[#2b2618]">
              有 {lowStockCount} 种食材库存为 0，记得补货。
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-white/10 px-4 py-3 text-sm text-white/78">
              录入菜谱和库存后，这里会持续汇总你的厨房状态。
            </p>
          )}
        </section>

        <section className="flex flex-1 flex-col pb-24 lg:pb-0">
          <nav className="sticky top-0 z-10 grid grid-cols-3 gap-2 border-b border-[#e2d7c8] bg-[#f7f3ed]/95 px-4 py-3 backdrop-blur lg:px-8">
            {[
              ['cook', '能做什么'],
              ['inventory', '库存'],
              ['recipes', '菜谱'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value as Tab)}
                className={`min-h-11 rounded-full px-3 text-sm font-bold transition ${
                  tab === value ? 'bg-[#224234] text-white shadow-sm' : 'bg-white text-[#445248]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 px-4 py-5 lg:px-8 lg:py-8">
            {tab === 'cook' && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <section className="rounded-lg border border-[#e2d7c8] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">按库存推荐</h2>
                      <p className="mt-1 text-sm text-[#69756d]">默认按每道菜自己的份数判断。</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {cookableRecipes.length === 0 ? (
                      <EmptyState text="先添加至少一道菜谱，就能看到可做清单。" />
                    ) : (
                      cookableRecipes.map(({ recipe, availability }) => (
                        <article key={recipe.id} className="rounded-lg border border-[#ece3d8] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{recipe.name}</h3>
                              <p className="mt-1 text-sm text-[#69756d]">{recipe.servings} 份标准用量</p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                availability.canCook
                                  ? 'bg-[#d9f2df] text-[#19572d]'
                                  : 'bg-[#ffe2d6] text-[#884022]'
                              }`}
                            >
                              {availability.canCook ? '可做' : '缺食材'}
                            </span>
                          </div>

                          {availability.canCook ? (
                            <p className="mt-3 text-sm text-[#445248]">库存足够做这道菜。</p>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {availability.missingIngredients.map((item) => (
                                <span key={item.id} className="rounded-full bg-[#fff3ed] px-3 py-1 text-xs text-[#884022]">
                                  缺 {item.name} {formatAmount(item.missingQuantity)} {item.unit}
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-[#e2d7c8] bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">菜谱详情</h2>
                  <label className="mt-4 block text-sm font-semibold" htmlFor="recipe-select">
                    选择菜谱
                  </label>
                  <select
                    id="recipe-select"
                    value={activeRecipeId}
                    onChange={(event) => {
                      const recipe = data.recipes.find((item) => item.id === event.target.value);
                      setSelectedRecipeId(event.target.value);
                      if (recipe) setTargetServings(String(recipe.servings));
                    }}
                    className="mt-2 h-12 w-full rounded-lg border border-[#d7cbbd] bg-white px-3 text-base"
                  >
                    {data.recipes.length === 0 ? (
                      <option value="">暂无菜谱</option>
                    ) : (
                      data.recipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.name}
                        </option>
                      ))
                    )}
                  </select>

                  <label className="mt-4 block text-sm font-semibold" htmlFor="target-servings">
                    想做份数
                  </label>
                  <input
                    id="target-servings"
                    type="number"
                    min="1"
                    step="1"
                    value={targetServings}
                    onChange={(event) => setTargetServings(event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-[#d7cbbd] px-3 text-base"
                  />

                  {selectedRecipe && selectedAvailability ? (
                    <div className="mt-5">
                      <div
                        className={`rounded-lg p-4 ${
                          selectedAvailability.canCook ? 'bg-[#edf8ee]' : 'bg-[#fff3ed]'
                        }`}
                      >
                        <p className="text-lg font-bold">
                          {selectedAvailability.canCook ? '库存足够，可以做' : '库存不足'}
                        </p>
                        {selectedRecipe.notes ? (
                          <p className="mt-1 text-sm text-[#5f6c63]">{selectedRecipe.notes}</p>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-2">
                        {selectedAvailability.requiredIngredients.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#faf7f1] px-3 py-3">
                            <span className="font-semibold">{item.name}</span>
                            <span className="text-sm text-[#5f6c63]">
                              需 {formatAmount(item.requiredQuantity)} {item.unit}
                              {' / '}
                              有 {formatAmount(item.availableQuantity)} {item.stockUnit ?? item.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={cookSelectedRecipe}
                        className="mt-5 min-h-12 w-full rounded-lg bg-[#e45f35] px-4 font-bold text-white disabled:bg-[#cfc6ba]"
                        disabled={!selectedAvailability.canCook}
                      >
                        已做这道菜，扣减库存
                      </button>
                    </div>
                  ) : (
                    <EmptyState text="新增菜谱后，这里会显示份数计算和库存扣减。" />
                  )}
                </section>
              </div>
            )}

            {tab === 'inventory' && (
              <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                <section className="rounded-lg border border-[#e2d7c8] bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">新增或更新库存</h2>
                  <form className="mt-4 space-y-3" onSubmit={addIngredient}>
                    <TextInput
                      id="ingredient-name"
                      label="食材名称"
                      value={ingredientName}
                      onChange={setIngredientName}
                      placeholder="例如 鸡蛋"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <UnitSelect
                        id="ingredient-unit"
                        label="单位"
                        value={ingredientUnit}
                        onChange={setIngredientUnit}
                      />
                      <NumberInput
                        id="ingredient-quantity"
                        label="数量"
                        value={ingredientQuantity}
                        onChange={setIngredientQuantity}
                        min="0"
                        step="1"
                      />
                    </div>
                    <button type="submit" className="min-h-12 w-full rounded-lg bg-[#224234] px-4 font-bold text-white">
                      保存库存
                    </button>
                  </form>
                </section>

                <section className="rounded-lg border border-[#e2d7c8] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">当前库存</h2>
                    <span className="text-sm font-semibold text-[#69756d]">{filteredIngredients.length} 项</span>
                  </div>
                  <input
                    aria-label="搜索库存"
                    value={inventorySearch}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="搜索食材"
                    className="mt-4 h-12 w-full rounded-lg border border-[#d7cbbd] px-3 text-base"
                  />

                  <div className="mt-4 space-y-3">
                    {filteredIngredients.length === 0 ? (
                      <EmptyState text="还没有匹配的库存食材。" />
                    ) : (
                      filteredIngredients.map((item) => (
                        <article key={item.id} className="rounded-lg border border-[#ece3d8] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{item.name}</h3>
                              <p className="text-sm text-[#69756d]">单位：{item.unit}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteIngredient(item.id)}
                              className="min-h-10 rounded-full bg-[#f4eee6] px-3 text-sm font-bold text-[#87452c]"
                            >
                              删除
                            </button>
                          </div>
                          <label className="mt-3 block text-sm font-semibold" htmlFor={`quantity-${item.id}`}>
                            库存数量
                          </label>
                          <input
                            id={`quantity-${item.id}`}
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity}
                            onChange={(event) => updateIngredientQuantity(item.id, Number(event.target.value))}
                            className="mt-2 h-12 w-full rounded-lg border border-[#d7cbbd] px-3 text-base"
                          />
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}

            {tab === 'recipes' && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
                <section className="rounded-lg border border-[#e2d7c8] bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">新增菜谱</h2>
                  <form className="mt-4 space-y-4" onSubmit={addRecipe}>
                    <TextInput
                      id="recipe-name"
                      label="菜名"
                      value={recipeName}
                      onChange={setRecipeName}
                      placeholder="例如 青椒肉丝"
                    />
                    <NumberInput
                      id="recipe-servings"
                      label="默认份数"
                      value={recipeServings}
                      onChange={setRecipeServings}
                      min="1"
                      step="1"
                    />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold">所需食材</h3>
                        <button
                          type="button"
                          onClick={addRecipeIngredientRow}
                          className="min-h-10 rounded-full bg-[#eaf3ea] px-4 text-sm font-bold text-[#224234]"
                        >
                          添加
                        </button>
                      </div>

                      {recipeIngredients.map((item) => (
                        <div key={item.id} className="rounded-lg bg-[#faf7f1] p-3">
                          <TextInput
                            id={`recipe-ingredient-name-${item.id}`}
                            label="食材名称"
                            value={item.name}
                            onChange={(value) => updateRecipeIngredient(item.id, 'name', value)}
                            placeholder="例如 鸡蛋"
                          />
                          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                            <UnitSelect
                              id={`recipe-ingredient-unit-${item.id}`}
                              label="单位"
                              value={item.unit}
                              onChange={(value) => updateRecipeIngredient(item.id, 'unit', value)}
                            />
                            <NumberInput
                              id={`recipe-ingredient-quantity-${item.id}`}
                              label="数量"
                              value={String(item.quantity || '')}
                              onChange={(value) => updateRecipeIngredient(item.id, 'quantity', value)}
                              min="0"
                              step="1"
                            />
                            <button
                              type="button"
                              onClick={() => removeRecipeIngredient(item.id)}
                              className="mt-7 min-h-12 rounded-lg bg-white px-3 text-sm font-bold text-[#87452c]"
                            >
                              删
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <label className="block text-sm font-semibold" htmlFor="recipe-notes">
                      备注
                    </label>
                    <textarea
                      id="recipe-notes"
                      value={recipeNotes}
                      onChange={(event) => setRecipeNotes(event.target.value)}
                      rows={3}
                      placeholder="可选：口味、做法提示或采购备注"
                      className="w-full rounded-lg border border-[#d7cbbd] px-3 py-3 text-base"
                    />

                    <button type="submit" className="min-h-12 w-full rounded-lg bg-[#224234] px-4 font-bold text-white">
                      保存菜谱
                    </button>
                  </form>
                </section>

                <section className="rounded-lg border border-[#e2d7c8] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">我的菜谱</h2>
                    <span className="text-sm font-semibold text-[#69756d]">{data.recipes.length} 道</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {data.recipes.length === 0 ? (
                      <EmptyState text="还没有菜谱。添加一道常做菜开始。" />
                    ) : (
                      data.recipes.map((recipe) => (
                        <article key={recipe.id} className="rounded-lg border border-[#ece3d8] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{recipe.name}</h3>
                              <p className="mt-1 text-sm text-[#69756d]">
                                {recipe.servings} 份 · {recipe.ingredients.length} 种食材
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteRecipe(recipe.id)}
                              className="min-h-10 rounded-full bg-[#f4eee6] px-3 text-sm font-bold text-[#87452c]"
                            >
                              删除
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {recipe.ingredients.map((item) => (
                              <span key={item.id} className="rounded-full bg-[#eef5ed] px-3 py-1 text-xs text-[#31553b]">
                                {item.name} {formatAmount(item.quantity)} {item.unit}
                              </span>
                            ))}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-20 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-lg bg-[#1f2520] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg lg:bottom-6">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-semibold" htmlFor={id}>
      {label}
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-lg border border-[#d7cbbd] px-3 text-base font-normal"
      />
    </label>
  );
}

function UnitSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = UNIT_OPTIONS.includes(value) ? UNIT_OPTIONS : [value, ...UNIT_OPTIONS];

  return (
    <label className="block text-sm font-semibold" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-[#d7cbbd] bg-white px-3 text-base font-normal"
      >
        {options.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  min,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  step: string;
}) {
  return (
    <label className="block text-sm font-semibold" htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-[#d7cbbd] px-3 text-base font-normal"
      />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[#d7cbbd] bg-[#faf7f1] px-4 py-6 text-center text-sm text-[#69756d]">{text}</p>;
}
