// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

String token = ApiTestHelper.login('admin@cemetery.vn')
String code = "TEST_PLOT_${System.currentTimeMillis()}"
Integer createdId = null
try {
    def body = [plotCode: code, zoneId: 1, rowNumber: '99', columnNumber: "${System.currentTimeMillis() % 1000}", price: 12345678, area: 4, direction: 'Nam', plotType: 'single', description: 'PA04 automated test data']
    def createResponse = ApiTestHelper.send('POST', '/admin/plots', body, token)
    WS.verifyResponseStatusCode(createResponse, 201)
    def created = ApiTestHelper.json(createResponse)
    assert created.success == true
    assert created.data.plotCode == code
    createdId = created.data.id as Integer
    assert createdId > 0

    def detailResponse = ApiTestHelper.send('GET', "/admin/plots/${createdId}", null, token)
    WS.verifyResponseStatusCode(detailResponse, 200)
    def detail = ApiTestHelper.json(detailResponse)
    assert detail.data.id == createdId
    assert detail.data.plotCode == code
    assert detail.data.price == 12345678
    println("TC-PLOTM-02 created plot id=${createdId}, code=${code}")
} finally {
    if (createdId != null) {
        def cleanup = ApiTestHelper.send('DELETE', "/admin/plots/${createdId}", null, token)
        WS.verifyResponseStatusCode(cleanup, 200)
        def afterCleanup = ApiTestHelper.send('GET', "/plots/${createdId}")
        WS.verifyResponseStatusCode(afterCleanup, 404)
        println("TC-PLOTM-02 cleanup complete for plot id=${createdId}")
    }
}
