import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GRIDS } from '../billing/grids';
import { PlansService } from '../billing/plans.service';
import { ProductsService } from '../billing/products/products.service';

/*
 * Usage: pnpm --filter @shobukapp/api grid:import <season> [--archive-others]
 * Upserts the season's plans and products by slug in the current Stripe mode.
 * Plans whose price changed move their subscribers at the next renewal.
 * --archive-others deactivates the active plans missing from the grid.
 */
async function main() {
  const season = process.argv[2];
  const grid = season ? GRIDS[season] : undefined;
  if (!grid) {
    throw new Error(
      `Usage: grid:import <season> [--archive-others]. Seasons: ${Object.keys(GRIDS).join(', ')}`,
    );
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const plans = app.get(PlansService);
    const products = app.get(ProductsService);
    for (const [index, plan] of grid.plans.entries()) {
      await plans.upsertFromGrid(plan, index);
      console.log(`plan ${plan.slug}`);
    }
    for (const [index, product] of grid.products.entries()) {
      await products.upsertFromGrid(product, index);
      console.log(`product ${product.slug}`);
    }
    if (process.argv.includes('--archive-others')) {
      const archived = await plans.archiveOutside(
        grid.plans.map((p) => p.slug),
      );
      console.log(`archived: ${archived.join(', ') || 'none'}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
