import { Response } from 'express';
import { HTTP_STATUS } from './constants';

interface ApiResponseData {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: unknown;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Format successful API response
 */
export const successResponse = (
  res: Response,
  data?: unknown,
  message?: string,
  statusCode: number = HTTP_STATUS.OK
): Response => {
  const response: ApiResponseData = {
    success: true,
    message,
    data,
  };

  return res.status(statusCode).json(response);
};

/**
 * Format error API response
 */
export const errorResponse = (
  res: Response,
  message: string,
  error?: unknown,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
): Response => {
  const response: ApiResponseData = {
    success: false,
    message,
    error,
  };

  return res.status(statusCode).json(response);
};

/**
 * Format paginated API response
 */
export const paginatedResponse = (
  res: Response,
  data: unknown,
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  },
  message?: string,
  statusCode: number = HTTP_STATUS.OK
): Response => {
  const response: ApiResponseData = {
    success: true,
    message,
    data,
    pagination,
  };

  return res.status(statusCode).json(response);
};

/**
 * Format created resource response
 */
export const createdResponse = (
  res: Response,
  data?: unknown,
  message?: string
): Response => {
  return successResponse(res, data, message, HTTP_STATUS.CREATED);
};

/**
 * Format no content response
 */
export const noContentResponse = (res: Response): Response => {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
};