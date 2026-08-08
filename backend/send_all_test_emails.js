"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const email_service_1 = require("./src/modules/email/email.service");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
async function bootstrap() {
    console.log('📧 Đang gửi lại toàn bộ email (FIX BACKGROUND INLINE CID) tới givemeaflower266@gmail.com...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const emailService = app.get(email_service_1.EmailService);
    const recipient = 'givemeaflower266@gmail.com';
    try {
        console.log('1. Đang gửi email tiếp nhận đơn dịch vụ mới (Inline Banner CID)...');
        await emailService.sendServiceOrderConfirmationEmail(recipient, {
            orderId: 1024,
            serviceName: 'Dịch vụ chăm sóc & cúng hoa tươi định kỳ',
            plotCode: 'A-01-001',
            requestedDate: '2026-08-15',
            amount: 1500000,
        });
        console.log('   => ✅ Đã gửi email tiếp nhận thành công!');
        console.log('2. Đang gửi email báo hoàn thành dịch vụ...');
        const dummyImgPath = path.join(__dirname, 'test_proof.jpg');
        if (!fs.existsSync(dummyImgPath)) {
            fs.writeFileSync(dummyImgPath, Buffer.from('dummy image content'));
        }
        await emailService.sendServiceOrderCompletionEmail(recipient, {
            orderId: 1024,
            serviceName: 'Dịch vụ chăm sóc & cúng hoa tươi định kỳ',
            completedAt: new Date().toISOString(),
            completionNote: 'Đã vệ sinh dọn dẹp khuôn viên phần mộ lô A-01-001, dâng hoa tươi trang nghiêm và dọn dẹp sạch sẽ.',
            attachments: [{ filename: 'anh_xac_nhan_hoan_thanh.jpg', path: dummyImgPath }],
        });
        console.log('   => ✅ Đã gửi email hoàn thành thành công!');
        console.log('3. Đang gửi email nhắc lịch giỗ / tưởng niệm...');
        await emailService.sendReminderEmail(recipient, 'Sắp đến ngày Giỗ Thân Nhân tại Lô A-01-001', 'Kính báo Quý khách, sắp đến ngày lễ giỗ tưởng niệm thân nhân tại lô A-01-001 (còn 3 ngày nữa - ngày 15/08/2026). Quý khách có thể bấm vào nút dưới đây để xem chi tiết lịch hoặc đặt dịch vụ dọn dẹp, dâng hoa.');
        console.log('   => ✅ Đã gửi email nhắc lịch thành công!');
        console.log('\n🎉 ĐÃ GỬI LẠI TOÀN BỘ EMAIL CÓ BACKGROUND INLINE CID THÀNH CÔNG VÀO GMAIL!');
    }
    catch (err) {
        console.error('❌ Lỗi khi gửi email:', err);
    }
    finally {
        await app.close();
        process.exit(0);
    }
}
bootstrap();
//# sourceMappingURL=send_all_test_emails.js.map