-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PLACED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "picnicAuthKey" TEXT,
    "picnicPendingKey" TEXT,
    "grocer" TEXT NOT NULL DEFAULT 'picnic',
    "ahAuthKey" TEXT,
    "paprikaEmail" TEXT,
    "paprikaPassword" TEXT,
    "pantryKeywords" TEXT[] DEFAULT ARRAY['oil', 'garlic', 'salt', 'sugar', 'flour', 'butter', 'vinegar', 'honey', 'stock', 'broth', 'bouillon', 'oregano', 'thyme', 'rosemary', 'cumin', 'paprika', 'cinnamon', 'nutmeg', 'basil', 'parsley', 'coriander', 'soy', 'baking', 'yeast', 'water', 'mustard']::TEXT[],
    "ignoredIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unavailableIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoWeekPlanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoWeekPlanMinRecipes" INTEGER NOT NULL DEFAULT 3,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sourceImageUrl" TEXT,
    "sourceUrl" TEXT,
    "origin" TEXT,
    "quantityOverrides" JSONB,
    "servings" TEXT,
    "prepTime" TEXT,
    "cookTime" TEXT,
    "ingredients" TEXT[],
    "instructions" TEXT[],
    "tags" TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paprikaUid" TEXT,
    "lastOrderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredientKey" TEXT NOT NULL,
    "rawIngredient" TEXT NOT NULL,
    "translated" TEXT NOT NULL,
    "grocer" TEXT NOT NULL DEFAULT 'picnic',
    "picnicId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "imageId" TEXT,
    "priceCents" INTEGER,
    "unitQuantity" TEXT,
    "isStaple" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("source")
);

-- CreateTable
CREATE TABLE "WeekPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipeIds" TEXT[],
    "lastOrderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "recipeIds" TEXT[],
    "recipeTitles" TEXT[],
    "listIds" TEXT[],
    "listTitles" TEXT[],
    "selectedProductIds" TEXT[],
    "selectedQuantities" JSONB,
    "cartItems" JSONB,
    "weekPlanId" TEXT,
    "unavailableItems" TEXT[],
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "grocer" TEXT NOT NULL DEFAULT 'picnic',
    "picnicId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "imageId" TEXT,
    "priceCents" INTEGER,
    "unitQuantity" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grocer" TEXT NOT NULL DEFAULT 'picnic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "picnicId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "imageId" TEXT,
    "priceCents" INTEGER,
    "unitQuantity" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GroceryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_userId_paprikaUid_key" ON "Recipe"("userId", "paprikaUid");

-- CreateIndex
CREATE INDEX "ProductMapping_userId_idx" ON "ProductMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMapping_userId_ingredientKey_grocer_key" ON "ProductMapping"("userId", "ingredientKey", "grocer");

-- CreateIndex
CREATE INDEX "WeekPlan_userId_idx" ON "WeekPlan"("userId");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "GroceryList_userId_idx" ON "GroceryList"("userId");

-- CreateIndex
CREATE INDEX "GroceryItem_listId_idx" ON "GroceryItem"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryItem_listId_picnicId_key" ON "GroceryItem"("listId", "picnicId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekPlan" ADD CONSTRAINT "WeekPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

