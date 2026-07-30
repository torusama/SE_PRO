import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface HttpExceptionBody {
  message?: string | string[];
  [key: string]: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse: HttpExceptionBody | null =
      exception instanceof HttpException
        ? (exception.getResponse() as HttpExceptionBody)
        : null;
    const rawMessage =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? exceptionResponse.message
        : undefined;

    if (rawMessage === undefined) {
      // Lỗi không xác định (vd: lỗi database, lỗi hệ thống...) — log đầy đủ
      // phía server để dev tra cứu, còn client chỉ nhận thông báo chung dễ hiểu
      // (không lộ chi tiết kỹ thuật/thông điệp gốc cho người dùng cuối).
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : exception,
      );
    }

    const message =
      rawMessage === undefined
        ? 'Đã có lỗi xảy ra từ hệ thống. Vui lòng thử lại sau ít phút.'
        : Array.isArray(rawMessage)
          ? rawMessage.join(', ')
          : rawMessage;

    response.status(status).json({
      success: false,
      message,
      data: null,
      error: HttpStatus[status] ?? 'ERROR',
    });
  }
}
