import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { Cache } from 'cache-manager';
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // 1. Create Product
  async create(createProductDto: CreateProductDto): Promise<Product> {
    const newProduct = new this.productModel(createProductDto);
    const savedProduct = await newProduct.save();

    // Cache invalidate - নতুন প্রডাক্ট এড হলে ক্যাশ ক্লিয়ার করা
    await this.cacheManager.del('all_products');
    return savedProduct;
  }

  // 2. Get All Products (With Redis Caching)
  async findAll(): Promise<Product[]> {
    const cacheKey = 'all_products';

    // ১. প্রথমে Redis-এ ডাটা আছে কি না চেক করব
    const cachedProducts = await this.cacheManager.get<Product[]>(cacheKey);
    if (cachedProducts) {
      console.log('⚡ Returning products from Redis Cache');
      return cachedProducts;
    }

    // ২. Redis-এ না থাকলে MongoDB থেকে আনব
    console.log('🐢 Fetching products from MongoDB Database');
    const products = await this.productModel.find().exec();

    // ৩. ডাটাটা Redis-এ ক্যাশ করে রাখব (TTL: 60 Seconds)
    await this.cacheManager.set(cacheKey, products, 60000);

    return products;
  }

  // 3. Get Single Product
  async findOne(id: string): Promise<Product> {
    const cacheKey = `product_${id}`;

    const cachedProduct = await this.cacheManager.get<Product>(cacheKey);
    if (cachedProduct) {
      console.log(`⚡ Returning product ${id} from Redis Cache`);
      return cachedProduct;
    }

    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.cacheManager.set(cacheKey, product, 60000);
    return product;
  }

  // 4. Update Product
  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, { new: true })
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Cache Invalidation
    await this.cacheManager.del('all_products');
    await this.cacheManager.del(`product_${id}`);

    return updatedProduct;
  }

  // 5. Remove Product
  async remove(id: string): Promise<{ message: string }> {
    const deletedProduct = await this.productModel.findByIdAndDelete(id).exec();

    if (!deletedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Cache Invalidation
    await this.cacheManager.del('all_products');
    await this.cacheManager.del(`product_${id}`);

    return { message: 'Product deleted successfully' };
  }
}
