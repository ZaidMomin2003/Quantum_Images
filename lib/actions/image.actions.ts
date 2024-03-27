"use server"

// Import necessary modules
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "../database/mongoose";
import { handleError } from "../utils";
import User from "../database/models/user.model";
import Image from "../database/models/image.model";
import { redirect } from "next/navigation";

import { v2 as cloudinary } from 'cloudinary'

// Function to populate user data in query
const populateUser = (query: any) => query.populate({
  path: 'author',
  model: User,
  select: '_id firstName lastName clerkId'
})

// Function to add image
export async function addImage({ image, userId, path }: AddImageParams) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Find the author/user
    const author = await User.findById(userId);

    if (!author) {
      throw new Error("User not found");
    }

    // Create a new image
    const newImage = await Image.create({
      ...image,
      author: author._id,
    })

    // Revalidate path
    revalidatePath(path);

    return JSON.parse(JSON.stringify(newImage));
  } catch (error) {
    // Handle errors
    handleError(error)
  }
}

// Function to update image
export async function updateImage({ image, userId, path }: UpdateImageParams) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Find the image to update
    const imageToUpdate = await Image.findById(image._id);

    if (!imageToUpdate || imageToUpdate.author.toHexString() !== userId) {
      throw new Error("Unauthorized or image not found");
    }

    // Update the image
    const updatedImage = await Image.findByIdAndUpdate(
      imageToUpdate._id,
      image,
      { new: true }
    )

    // Revalidate path
    revalidatePath(path);

    return JSON.parse(JSON.stringify(updatedImage));
  } catch (error) {
    // Handle errors
    handleError(error)
  }
}

// Function to delete image
export async function deleteImage(imageId: string) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Delete the image
    await Image.findByIdAndDelete(imageId);
  } catch (error) {
    // Handle errors
    handleError(error)
  } finally {
    // Redirect to home page
    redirect('/')
  }
}

// Function to get image by ID
export async function getImageById(imageId: string) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Find the image by ID and populate user data
    const image = await populateUser(Image.findById(imageId));

    if (!image) throw new Error("Image not found");

    return JSON.parse(JSON.stringify(image));
  } catch (error) {
    // Handle errors
    handleError(error)
  }
}

// Function to get all images
export async function getAllImages({ limit = 9, page = 1, searchQuery = '' }: {
  limit?: number;
  page: number;
  searchQuery?: string;
}) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Configure cloudinary
    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    })

    let expression = 'folder=imaginify';

    if (searchQuery) {
      expression += ` AND ${searchQuery}`
    }

    // Search images in cloudinary
    const { resources } = await cloudinary.search
      .expression(expression)
      .execute();

    const resourceIds = resources.map((resource: any) => resource.public_id);

    let query = {};

    if (searchQuery) {
      query = {
        publicId: {
          $in: resourceIds
        }
      }
    }

    const skipAmount = (Number(page) - 1) * limit;

    // Find images and populate user data
    const images = await populateUser(Image.find(query))
      .sort({ updatedAt: -1 })
      .skip(skipAmount)
      .limit(limit);

    // Get total images count and saved images count
    const totalImages = await Image.find(query).countDocuments();
    const savedImages = await Image.find().countDocuments();

    return {
      data: JSON.parse(JSON.stringify(images)),
      totalPage: Math.ceil(totalImages / limit),
      savedImages,
    }
  } catch (error) {
    // Handle errors
    handleError(error)
  }
}

// Function to get user images
export async function getUserImages({
  limit = 9,
  page = 1,
  userId,
}: {
  limit?: number;
  page: number;
  userId: string;
}) {
  try {
    // Connect to the database
    await connectToDatabase();

    const skipAmount = (Number(page) - 1) * limit;

    // Find user images and populate user data
    const images = await populateUser(Image.find({ author: userId }))
      .sort({ updatedAt: -1 })
      .skip(skipAmount)
      .limit(limit);

    // Get total user images count
    const totalImages = await Image.find({ author: userId }).countDocuments();

    return {
      data: JSON.parse(JSON.stringify(images)),
      totalPages: Math.ceil(totalImages / limit),
    };
  } catch (error) {
    // Handle errors
    handleError(error);
  }
}
